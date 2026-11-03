import { promises as fs } from "node:fs";
import path from "node:path";
export class StoreError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
// Same character rule as the 0.x save route, applied to each path segment
const UNSAFE = /[\\?%*:|"<>\s]/g;
const SQL_EXT = /\.sql$/i;
function describe(sql) {
    return /^--\s*description:\s*(.+)$/im.exec(sql)?.[1].trim();
}
const byName = (a, b) => a.name.localeCompare(b.name);
export class QueryStore {
    dataDir;
    constructor(dataDir) {
        this.dataDir = dataDir;
    }
    sanitizePath(input) {
        const segments = input.replace(SQL_EXT, "").split("/");
        if (input.startsWith("/") || segments.some((s) => s === "")) {
            throw new StoreError("invalid", `Invalid path "${input}"`);
        }
        const clean = segments.map((s) => s.replace(UNSAFE, "_"));
        if (clean.some((s) => s === "." || s === ".." || s.startsWith("."))) {
            throw new StoreError("invalid", `Invalid path "${input}"`);
        }
        return clean.join("/");
    }
    /** Absolute path for a query path, verified (via realpath of the nearest existing ancestor) to stay inside dataDir. */
    async resolve(p, suffix = "") {
        const rel = this.sanitizePath(p);
        const root = await fs.realpath(this.dataDir);
        const abs = path.join(root, rel + suffix);
        let probe = abs;
        for (;;) {
            try {
                const real = await fs.realpath(probe);
                if (real !== root && !real.startsWith(root + path.sep)) {
                    throw new StoreError("invalid", `Path "${p}" is outside the data directory`);
                }
                return abs;
            }
            catch (e) {
                if (e instanceof StoreError)
                    throw e;
                const parent = path.dirname(probe);
                if (parent === probe)
                    return abs;
                probe = parent;
            }
        }
    }
    /** Existing file for a query path, honouring any extension case (.sql / .SQL). */
    async queryFile(p) {
        const base = await this.resolve(p);
        const dir = path.dirname(base);
        const name = path.basename(base);
        let entries;
        try {
            entries = await fs.readdir(dir);
        }
        catch {
            return null;
        }
        const hit = entries.find((e) => SQL_EXT.test(e) && e.replace(SQL_EXT, "") === name);
        return hit ? path.join(dir, hit) : null;
    }
    async folderDir(p) {
        const abs = await this.resolve(p);
        try {
            return (await fs.stat(abs)).isDirectory() ? abs : null;
        }
        catch {
            return null;
        }
    }
    async exists(p) {
        return (await this.queryFile(p)) !== null || (await this.folderDir(p)) !== null;
    }
    async tree() {
        const walk = async (abs, rel) => {
            const entries = await fs.readdir(abs, { withFileTypes: true });
            const folders = [];
            const queries = [];
            for (const e of entries) {
                if (e.name.startsWith("."))
                    continue;
                const childRel = rel ? `${rel}/${e.name}` : e.name;
                if (e.isDirectory()) {
                    folders.push({ type: "folder", name: e.name, path: childRel, children: await walk(path.join(abs, e.name), childRel) });
                }
                else if (e.isFile() && SQL_EXT.test(e.name)) {
                    const name = e.name.replace(SQL_EXT, "");
                    const head = (await fs.readFile(path.join(abs, e.name), "utf8")).slice(0, 2000);
                    const node = { type: "query", name, path: rel ? `${rel}/${name}` : name };
                    const description = describe(head);
                    if (description)
                        node.description = description;
                    queries.push(node);
                }
            }
            return [...folders.sort(byName), ...queries.sort(byName)];
        };
        return walk(this.dataDir, "");
    }
    async read(p) {
        const file = await this.queryFile(p);
        if (!file)
            throw new StoreError("not_found", `Query "${p}" not found`);
        return (await fs.readFile(file, "utf8")).replace(/^﻿/, "");
    }
    async write(p, sql) {
        const file = (await this.queryFile(p)) ?? (await this.resolve(p, ".sql"));
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, sql);
    }
    async move(from, to) {
        const src = (await this.queryFile(from)) ?? (await this.folderDir(from));
        if (!src)
            throw new StoreError("not_found", `"${from}" not found`);
        if (await this.exists(to))
            throw new StoreError("exists", `"${to}" already exists`);
        const isFile = !(await fs.stat(src)).isDirectory();
        const dest = await this.resolve(to, isFile ? path.extname(src) : "");
        if (!isFile && (dest + path.sep).startsWith(src + path.sep)) {
            throw new StoreError("invalid", `Can't move "${from}" into itself`);
        }
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.rename(src, dest);
    }
    async duplicate(from, to) {
        const src = await this.queryFile(from);
        if (!src)
            throw new StoreError("not_found", `Query "${from}" not found`);
        if (await this.exists(to))
            throw new StoreError("exists", `"${to}" already exists`);
        const dest = await this.resolve(to, ".sql");
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
    }
    async remove(p) {
        const file = await this.queryFile(p);
        if (file) {
            const sql = await this.read(p);
            await fs.unlink(file);
            return { deletedSql: { [this.sanitizePath(p)]: sql } };
        }
        const dir = await this.folderDir(p);
        if (!dir)
            throw new StoreError("not_found", `"${p}" not found`);
        const deletedSql = {};
        const collect = async (abs, rel) => {
            for (const e of await fs.readdir(abs, { withFileTypes: true })) {
                const childRel = `${rel}/${e.name}`;
                if (e.isDirectory())
                    await collect(path.join(abs, e.name), childRel);
                else if (SQL_EXT.test(e.name)) {
                    deletedSql[childRel.replace(SQL_EXT, "")] = (await fs.readFile(path.join(abs, e.name), "utf8")).replace(/^﻿/, "");
                }
            }
        };
        await collect(dir, this.sanitizePath(p));
        await fs.rm(dir, { recursive: true });
        return { deletedSql };
    }
    async createFolder(p) {
        if (await this.exists(p))
            throw new StoreError("exists", `"${p}" already exists`);
        await fs.mkdir(await this.resolve(p), { recursive: true });
    }
    async countQueries(p) {
        const dir = await this.folderDir(p);
        if (!dir)
            return (await this.queryFile(p)) ? 1 : 0;
        const entries = await fs.readdir(dir, { recursive: true });
        return entries.filter((e) => SQL_EXT.test(e) && !e.split(path.sep).some((s) => s.startsWith("."))).length;
    }
}
//# sourceMappingURL=store.js.map