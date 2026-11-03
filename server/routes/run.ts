// Run a saved query by URL, for Windmill / Grafana / Excel / curl.
import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import type { AppConfig } from "../config.js";
import type { ClusterRunner } from "../axl.js";
import type { QueryStore } from "../store.js";
import type { ActivityLog } from "../activityLog.js";
import { identityFrom } from "../identity.js";
import { resolveVariables, missingVariables } from "../../shared/variables.js";
import { toCsv } from "../../shared/csv.js";
import { sendStoreError } from "./queries.js";

function keyMatches(header: string | undefined, apiKey: string): boolean {
  const given = Buffer.from(header?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(apiKey);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

interface RunDeps {
  config: AppConfig;
  runner: ClusterRunner;
  store: QueryStore;
  log: ActivityLog;
}

export async function runRoutes(app: FastifyInstance, opts: RunDeps) {
  const { config, runner, store, log } = opts;

  app.get<{ Params: { "*": string }; Querystring: Record<string, string> }>("/api/run/*", async (req, reply) => {
    let user = identityFrom(req.headers);
    if (config.apiKey && !req.headers["remote-user"]) {
      if (!keyMatches(req.headers.authorization, config.apiKey)) {
        return reply.code(401).send({ error: "unauthorized", message: "Missing or invalid API key" });
      }
      user = "api-key";
    }

    const { cluster, format = "json", ...vars } = req.query;
    let queryPath: string;
    let saved: string;
    try {
      queryPath = store.sanitizePath(req.params["*"]);
      saved = await store.read(queryPath);
    } catch (err) {
      return sendStoreError(reply, err);
    }

    const missing = missingVariables(saved, vars);
    if (missing.length) {
      return reply.code(400).send({ error: "missing_variables", missing, message: `Missing variable(s): ${missing.join(", ")}` });
    }

    const clusterIds = cluster ? cluster.split(",").map((s) => s.trim()).filter(Boolean) : [config.defaultClusterId];
    const unknown = clusterIds.filter((id) => !runner.has(id));
    if (unknown.length) {
      return reply.code(400).send({ error: "unknown_cluster", message: `Unknown cluster(s): ${unknown.join(", ")}` });
    }

    const sql = resolveVariables(saved, vars);
    const results = await runner.run(sql, clusterIds);
    const summary = results.map((r) => ({
      id: r.clusterId,
      status: r.status,
      rowCount: r.rowCount,
      durationMs: r.durationMs,
      ...(r.error ? { error: r.error } : {}),
    }));
    await log.append({ user, action: "run", source: "api", path: queryPath, sql, clusters: summary });

    const throttled = results.filter((r) => r.throttle);
    if (throttled.length) {
      return reply.code(413).send({
        error: "too_large",
        message: "Result exceeds the UCM 8 MB limit; add a WHERE clause or use the editor's batch fetch",
        clusters: throttled.map((r) => ({ id: r.clusterId, ...r.throttle })),
      });
    }

    const multi = clusterIds.length > 1;
    const names = new Map(config.clusters.map((c) => [c.id, c.name]));
    const columns: string[] = multi ? ["cluster"] : [];
    for (const r of results) for (const c of r.columns) if (!columns.includes(c)) columns.push(c);
    const rows = results.flatMap((r) => (multi ? r.rows.map((row) => ({ cluster: names.get(r.clusterId)!, ...row })) : r.rows));

    if (format === "csv") {
      const name = queryPath.split("/").pop();
      return reply
        .type("text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="${name}.csv"`)
        .send(toCsv(columns, rows));
    }
    return { columns, rows, clusters: summary };
  });
}
