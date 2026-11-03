import { ZipArchive } from "archiver";
import { StoreError } from "../store.js";
import { formatForSave } from "../../shared/formatSql.js";
import { identityFrom } from "../identity.js";
const STATUS = { invalid: 400, not_found: 404, exists: 409 };
export function sendStoreError(reply, err) {
    if (err instanceof StoreError) {
        return reply.code(STATUS[err.code]).send({ error: err.code, message: err.message });
    }
    throw err;
}
function queryPaths(nodes) {
    return nodes.flatMap((n) => (n.type === "folder" ? queryPaths(n.children ?? []) : [n.path]));
}
export async function queriesRoutes(app, opts) {
    const { store, log } = opts;
    const record = (req, e) => log.append({ user: identityFrom(req.headers), source: "ui", ...e });
    app.get("/api/queries", async () => ({ tree: await store.tree() }));
    app.get("/api/queries/*", async (req, reply) => {
        try {
            const p = store.sanitizePath(req.params["*"]);
            return { path: p, sql: await store.read(p) };
        }
        catch (err) {
            return sendStoreError(reply, err);
        }
    });
    app.put("/api/queries/*", async (req, reply) => {
        if (typeof req.body?.sql !== "string")
            return reply.code(400).send({ error: "invalid", message: "sql is required" });
        try {
            const p = store.sanitizePath(req.params["*"]);
            await store.write(p, formatForSave(req.body.sql));
            await record(req, { action: "save", path: p });
            return { path: p };
        }
        catch (err) {
            return sendStoreError(reply, err);
        }
    });
    for (const action of ["move", "duplicate"]) {
        app.post(`/api/queries/${action}`, async (req, reply) => {
            const { from, to } = req.body ?? {};
            if (!from || !to)
                return reply.code(400).send({ error: "invalid", message: "from and to are required" });
            try {
                const src = store.sanitizePath(from);
                const dest = store.sanitizePath(to);
                await (action === "move" ? store.move(src, dest) : store.duplicate(src, dest));
                await record(req, { action, path: src, to: dest });
                return { path: dest };
            }
            catch (err) {
                return sendStoreError(reply, err);
            }
        });
    }
    app.delete("/api/queries/*", async (req, reply) => {
        try {
            const p = store.sanitizePath(req.params["*"]);
            const { deletedSql } = await store.remove(p);
            await record(req, { action: "delete", path: p, deletedSql });
            return { deleted: Object.keys(deletedSql) };
        }
        catch (err) {
            return sendStoreError(reply, err);
        }
    });
    app.get("/api/queries-count/*", async (req, reply) => {
        try {
            return { count: await store.countQueries(store.sanitizePath(req.params["*"])) };
        }
        catch (err) {
            return sendStoreError(reply, err);
        }
    });
    app.post("/api/folders", async (req, reply) => {
        if (!req.body?.path)
            return reply.code(400).send({ error: "invalid", message: "path is required" });
        try {
            const p = store.sanitizePath(req.body.path);
            await store.createFolder(p);
            await record(req, { action: "folder_create", path: p });
            return { path: p };
        }
        catch (err) {
            return sendStoreError(reply, err);
        }
    });
    app.get("/api/export.zip", async (_req, reply) => {
        const archive = new ZipArchive({ zlib: { level: 9 } });
        for (const p of queryPaths(await store.tree())) {
            archive.append(await store.read(p), { name: `${p}.sql` });
        }
        const stamp = new Date().toISOString().slice(0, 10);
        reply
            .type("application/zip")
            .header("content-disposition", `attachment; filename="cucm-sql-queries-${stamp}.zip"`);
        archive.finalize();
        return reply.send(archive);
    });
}
//# sourceMappingURL=queries.js.map