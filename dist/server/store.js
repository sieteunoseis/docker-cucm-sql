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
    /** Validates a path for lookup: no traversal, no hidden segments. Names are kept exactly as given. */
    checkPath(input) {
        const segments = input.replace(SQL_EXT, "").split("/");
        if (input.startsWith("/") || segments.some((s) => s === "" || s === "." || s === ".." || s.startsWith("."))) {
            throw new StoreError("invalid", `Invalid path "${input}"`);
        }
        return segments.join("/");
    }
    /** Path for a name being created: checkPath plus the 0.x character rule (spaces etc. → _). */
    sanitizePath(input) {
        const clean = this.checkPath(input)
            .split("/")
            .map((s) => s.replace(UNSAFE, "_"));
        if (clean.some((s) => s.startsWith(".")))
            throw new StoreError("invalid", `Invalid path "${input}"`);
        return clean.join("/");
    }
    async root() {
        return fs.realpath(this.dataDir);
    }
    async assertInside(real, p) {
        const root = await this.root();
        if (real !== root && !real.startsWith(root + path.sep)) {
            throw new StoreError("invalid", `Path "${p}" is outside the data directory`);
        }
    }
    /** Absolute path for a checked relative path, verified (via realpath of the nearest existing ancestor) to stay inside dataDir. */
    async resolve(rel, suffix = "") {
        const abs = path.join(await this.root(), rel + suffix);
        let probe = abs;
        for (;;) {
            try {
                await this.assertInside(await fs.realpath(probe), rel);
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
    /** Existing file for an exact relative path, honouring any extension case (.sql / .SQL). */
    async fileAt(rel) {
        const base = await this.resolve(rel);
        let entries;
        try {
            entries = await fs.readdir(path.dirname(base));
        }
        catch {
            return null;
        }
        const name = path.basename(base);
        const hit = entries.find((e) => SQL_EXT.test(e) && e.replace(SQL_EXT, "") === name);
        if (!hit)
            return null;
        const file = path.join(path.dirname(base), hit);
        // the file itself may be a symlink pointing outside the data dir
        await this.assertInside(await fs.realpath(file), rel);
        return file;
    }
    async dirAt(rel) {
        const abs = await this.resolve(rel);
        try {
            return (await fs.stat(abs)).isDirectory() ? abs : null;
        }
        catch {
            return null;
        }
    }
    /**
     * Finds an existing query or folder: first by the exact name (hand-made files may contain spaces),
     * then by its sanitized form (how saved names and old links spell it).
     */
    async locate(p) {
        const candidates = [...new Set([this.checkPath(p), this.sanitizePath(p)])];
        for (const rel of candidates) {
            const file = await this.fileAt(rel);
            if (file)
                return { rel, file, dir: null };
            const dir = await this.dirAt(rel);
            if (dir)
                return { rel, file: null, dir };
        }
        return null;
    }
    /** Relative path of an existing query, or null. */
    async find(p) {
        const hit = await this.locate(p);
        return hit?.file ? hit.rel : null;
    }
    async exists(rel) {
        return (await this.fileAt(rel)) !== null || (await this.dirAt(rel)) !== null;
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
        const hit = await this.locate(p);
        if (!hit?.file)
            throw new StoreError("not_found", `Query "${p}" not found`);
        return (await fs.readFile(hit.file, "utf8")).replace(/^\uFEFF/, "");
    }
    /**
     * Saves a query and returns the path it was saved at. An existing query (found by exact or
     * sanitized name) is overwritten in place unless create is set; new names are sanitized.
     */
    async write(p, sql, opts = {}) {
        const hit = await this.locate(p);
        if (hit && (opts.create || !hit.file))
            throw new StoreError("exists", `"${hit.rel}" already exists`);
        const rel = hit?.rel ?? this.sanitizePath(p);
        const file = hit?.file ?? (await this.resolve(rel, ".sql"));
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, sql);
        return rel;
    }
    async move(from, to) {
        const src = await this.locate(from);
        if (!src)
            throw new StoreError("not_found", `"${from}" not found`);
        const destRel = this.sanitizePath(to);
        if (await this.exists(destRel))
            throw new StoreError("exists", `"${destRel}" already exists`);
        const srcPath = (src.file ?? src.dir);
        const dest = await this.resolve(destRel, src.file ? path.extname(src.file) : "");
        if (src.dir && (dest + path.sep).startsWith(src.dir + path.sep)) {
            throw new StoreError("invalid", `Can't move "${from}" into itself`);
        }
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.rename(srcPath, dest);
        return destRel;
    }
    async duplicate(from, to) {
        const src = await this.locate(from);
        if (!src?.file)
            throw new StoreError("not_found", `Query "${from}" not found`);
        const destRel = this.sanitizePath(to);
        if (await this.exists(destRel))
            throw new StoreError("exists", `"${destRel}" already exists`);
        const dest = await this.resolve(destRel, ".sql");
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src.file, dest);
        return destRel;
    }
    async remove(p) {
        const hit = await this.locate(p);
        if (!hit)
            throw new StoreError("not_found", `"${p}" not found`);
        if (hit.file) {
            const sql = (await fs.readFile(hit.file, "utf8")).replace(/^\uFEFF/, "");
            await fs.unlink(hit.file);
            return { deletedSql: { [hit.rel]: sql } };
        }
        const deletedSql = {};
        const collect = async (abs, rel) => {
            for (const e of await fs.readdir(abs, { withFileTypes: true })) {
                const childRel = `${rel}/${e.name}`;
                if (e.isDirectory())
                    await collect(path.join(abs, e.name), childRel);
                else if (SQL_EXT.test(e.name)) {
                    deletedSql[childRel.replace(SQL_EXT, "")] = (await fs.readFile(path.join(abs, e.name), "utf8")).replace(/^\uFEFF/, "");
                }
            }
        };
        await collect(hit.dir, hit.rel);
        await fs.rm(hit.dir, { recursive: true });
        return { deletedSql };
    }
    async createFolder(p) {
        const rel = this.sanitizePath(p);
        if (await this.exists(rel))
            throw new StoreError("exists", `"${rel}" already exists`);
        await fs.mkdir(await this.resolve(rel), { recursive: true });
        return rel;
    }
    async countQueries(p) {
        const hit = await this.locate(p);
        if (!hit)
            return 0;
        if (hit.file)
            return 1;
        const dir = hit.dir;
        const entries = await fs.readdir(dir, { recursive: true });
        return entries.filter((e) => SQL_EXT.test(e) && !e.split(path.sep).some((s) => s.startsWith("."))).length;
    }
}
//# sourceMappingURL=store.js.map