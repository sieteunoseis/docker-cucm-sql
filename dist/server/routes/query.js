export async function queryRoutes(app, opts) {
    const { config, runner } = opts;
    app.post("/api/query", async (req, reply) => {
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
//# sourceMappingURL=query.js.map