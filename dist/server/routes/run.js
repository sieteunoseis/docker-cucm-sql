import { timingSafeEqual } from "node:crypto";
import { identityFrom } from "../identity.js";
import { resolveVariables, missingVariables } from "../../shared/variables.js";
import { toCsv } from "../../shared/csv.js";
import { sendStoreError } from "./queries.js";
import { StoreError } from "../store.js";
function keyMatches(header, apiKey) {
    const given = Buffer.from(header?.replace(/^Bearer\s+/i, "") ?? "");
    const expected = Buffer.from(apiKey);
    return given.length === expected.length && timingSafeEqual(given, expected);
}
export async function runRoutes(app, opts) {
    const { config, runner, store, log } = opts;
    app.get("/api/run/*", async (req, reply) => {
        // When API_KEY is set it is always required: Remote-User is only trustworthy if the proxy
        // overwrites it, and /api/run is usually exempted from Authelia for scripts.
        if (config.apiKey && !keyMatches(req.headers.authorization, config.apiKey)) {
            return reply.code(401).send({ error: "unauthorized", message: "Missing or invalid API key" });
        }
        const identity = identityFrom(req.headers);
        const user = identity === "anonymous" && config.apiKey ? "api-key" : identity;
        const { cluster, format = "json", ...vars } = req.query;
        let queryPath;
        let saved;
        try {
            const found = await store.find(req.params["*"]);
            if (!found)
                throw new StoreError("not_found", `Query "${req.params["*"]}" not found`);
            queryPath = found;
            saved = await store.read(found);
        }
        catch (err) {
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
        await log
            .append({ user, action: "run", source: "api", path: queryPath, sql, clusters: summary })
            .catch((err) => console.error(`Activity log write failed: ${err.message}`));
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
        const columns = multi ? ["cluster"] : [];
        for (const r of results)
            for (const c of r.columns)
                if (!columns.includes(c))
                    columns.push(c);
        const rows = results.flatMap((r) => (multi ? r.rows.map((row) => ({ cluster: names.get(r.clusterId), ...row })) : r.rows));
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
//# sourceMappingURL=run.js.map