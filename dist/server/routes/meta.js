import { publicCluster } from "../config.js";
export async function metaRoutes(app, opts) {
    const { config, runner } = opts;
    app.get("/api/clusters", async () => config.clusters.map(publicCluster));
    app.get("/api/clusters/:id/test", async (req, reply) => {
        if (!runner.has(req.params.id))
            return reply.code(404).send({ error: "not_found", message: "Unknown cluster" });
        return runner.test(req.params.id);
    });
    app.get("/api/schema", async (req, reply) => {
        const id = req.query.cluster || config.defaultClusterId;
        if (!runner.has(id))
            return reply.code(404).send({ error: "not_found", message: "Unknown cluster" });
        try {
            return { tables: await runner.schema(id) };
        }
        catch (err) {
            return reply.code(502).send({ error: "schema_failed", message: err.message });
        }
    });
}
//# sourceMappingURL=meta.js.map