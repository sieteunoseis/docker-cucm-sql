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
    // a log that can't be written (e.g. read-only volume) must not fail the user's action
    const record = (req, e) => log.append({ user: identityFrom(req.headers), source: "ui", ...e }).catch((err) => {
        console.error(`Activity log write failed: ${err.message}`);
    });
    app.get("/api/queries", async () => ({ tree: await store.tree() }));
    app.get("/api/queries/*", async (req, reply) => {
        try {
            const found = await store.find(req.params["*"]);
            if (!found)
                throw new StoreError("not_found", `Query "${req.params["*"]}" not found`);
            return { path: found, sql: await store.read(found) };
        }
        catch (err) {
            return sendStoreError(reply, err);
        }
    });
    // ?create=1: refuse to replace an existing query (Save / Save as dialogs); plain PUT overwrites
    app.put("/api/queries/*", async (req, reply) => {
        if (typeof req.body?.sql !== "string")
            return reply.code(400).send({ error: "invalid", message: "sql is required" });
        try {
            const create = req.query.create === "1";
            const existing = create ? null : await store.find(req.params["*"]);
            const previousSql = existing ? await store.read(existing) : undefined;
            const p = await store.write(req.params["*"], formatForSave(req.body.sql), { create });
            await record(req, { action: "save", path: p, ...(previousSql !== undefined ? { previousSql } : {}) });
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
                const src = store.checkPath(from);
                const dest = await (action === "move" ? store.move(src, to) : store.duplicate(src, to));
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
            const p = store.checkPath(req.params["*"]);
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
            return { count: await store.countQueries(store.checkPath(req.params["*"])) };
        }
        catch (err) {
            return sendStoreError(reply, err);
        }
    });
    app.post("/api/folders", async (req, reply) => {
        if (!req.body?.path)
            return reply.code(400).send({ error: "invalid", message: "path is required" });
        try {
            const p = await store.createFolder(req.body.path);
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