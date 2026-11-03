import { formatForSave } from "../../shared/formatSql.js";
export async function legacyRoutes(app, opts) {
    const { config, runner, store } = opts;
    app.post("/api/getdata", async (req, reply) => {
        const result = await runner.runOne(req.body?.query ?? "", config.defaultClusterId);
        if (result.status !== "ok")
            return reply.code(500).send({ message: result.error });
        if (!result.rows.length)
            return reply.code(204).send();
        return { row: result.rows };
    });
    app.get("/api/getfiles", async () => (await store.tree()).filter((n) => n.type === "query").map((n) => `${n.name}.sql`).sort((a, b) => a.localeCompare(b)));
    app.get("/api/getquery/:name", async (req, reply) => {
        try {
            return { fileName: req.params.name, data: await store.read(store.sanitizePath(req.params.name)) };
        }
        catch {
            return reply.code(500).send({ message: "No file found" });
        }
    });
    app.post("/api/savequery", async (req, reply) => {
        try {
            // 0.x replaced "/" too, so legacy saves always land at the top level
            const name = String(req.body?.fileName ?? "").replace(/[/\\?%*:|"<>\s]/g, "_");
            await store.write(store.sanitizePath(name), formatForSave(String(req.body?.query ?? "")));
            return reply.type("text/html").send("Successfully saved file");
        }
        catch {
            return reply.code(500).send("Error");
        }
    });
}
//# sourceMappingURL=legacy.js.map