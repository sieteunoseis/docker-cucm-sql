import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
const FILE = /^(\d{4})-(\d{2})\.jsonl$/;
/** Append-only JSON Lines, one file per UTC month: <dir>/YYYY-MM.jsonl */
export class ActivityLog {
    dir;
    retentionMonths;
    now;
    constructor(dir, retentionMonths, now = () => new Date()) {
        this.dir = dir;
        this.retentionMonths = retentionMonths;
        this.now = now;
    }
    async append(e) {
        const ts = this.now().toISOString();
        const entry = { id: `${ts}-${randomBytes(3).toString("hex")}`, ts, ...e };
        await fs.mkdir(this.dir, { recursive: true });
        await fs.appendFile(path.join(this.dir, `${ts.slice(0, 7)}.jsonl`), JSON.stringify(entry) + "\n");
        return entry;
    }
    async files() {
        try {
            return (await fs.readdir(this.dir)).filter((f) => FILE.test(f)).sort();
        }
        catch {
            return [];
        }
    }
    async query(f) {
        const limit = Math.min(Math.max(f.limit ?? 50, 1), 500);
        const q = f.q?.toLowerCase();
        const user = f.user?.toLowerCase();
        // inclusive date range on YYYY-MM-DD (UTC)
        const toExclusive = f.to ? new Date(Date.parse(f.to) + 86400000).toISOString() : null;
        const matches = (e) => (!user || e.user.toLowerCase().includes(user)) &&
            (!f.action || e.action === f.action) &&
            (!f.from || e.ts >= f.from) &&
            (!toExclusive || e.ts < toExclusive) &&
            (!q || [e.sql, e.path, e.to, e.user].some((s) => s?.toLowerCase().includes(q)));
        const entries = [];
        let passedCursor = !f.cursor;
        for (const file of (await this.files()).reverse()) {
            if (f.from && file.slice(0, 7) < f.from.slice(0, 7))
                break;
            const lines = (await fs.readFile(path.join(this.dir, file), "utf8")).split("\n");
            for (let i = lines.length - 1; i >= 0; i--) {
                if (!lines[i].trim())
                    continue;
                let e;
                try {
                    e = JSON.parse(lines[i]);
                }
                catch {
                    continue;
                }
                if (!passedCursor) {
                    if (e.id === f.cursor)
                        passedCursor = true;
                    continue;
                }
                if (!matches(e))
                    continue;
                if (entries.length === limit)
                    return { entries, nextCursor: entries[entries.length - 1].id };
                entries.push(e);
            }
        }
        return { entries, nextCursor: null };
    }
    async prune() {
        const now = this.now();
        const cutoff = now.getUTCFullYear() * 12 + now.getUTCMonth() - this.retentionMonths;
        const deleted = [];
        for (const file of await this.files()) {
            const [, y, m] = FILE.exec(file);
            if (Number(y) * 12 + Number(m) - 1 < cutoff) {
                await fs.unlink(path.join(this.dir, file));
                deleted.push(file);
            }
        }
        return deleted;
    }
}
//# sourceMappingURL=activityLog.js.map