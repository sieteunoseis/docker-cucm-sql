import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";
import type { ClusterResult, ClusterRunner } from "../axl.js";

export interface RunEvent {
  req: FastifyRequest;
  sql: string;
  path?: string;
  results: ClusterResult[];
}

export interface QueryRouteOptions {
  config: AppConfig;
  runner: ClusterRunner;
  onRun?: (e: RunEvent) => Promise<void> | void;
}

export async function queryRoutes(app: FastifyInstance, opts: QueryRouteOptions) {
  const { config, runner } = opts;

  app.post<{ Body: { sql?: string; clusters?: string[]; path?: string } }>("/api/query", async (req, reply) => {
    const sql = req.body?.sql;
    if (typeof sql !== "string" || !sql.trim()) {
      return reply.code(400).send({ error: "invalid", message: "sql is required" });
    }
    const clusters = req.body.clusters?.length ? req.body.clusters : [config.defaultClusterId];
    const unknown = clusters.filter((id) => !runner.has(id));
    if (unknown.length) {
      return reply.code(400).send({ error: "unknown_cluster", message: `Unknown cluster(s): ${unknown.join(", ")}` });
    }
    const results = await runner.run(sql, clusters);
    await opts.onRun?.({ req, sql, path: req.body.path, results });
    return { results };
  });
}
