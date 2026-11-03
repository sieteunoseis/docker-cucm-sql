import axlService from "cisco-axl";
import { parseThrottle } from "../shared/paging.js";
const SCHEMA_TTL_MS = 60 * 60 * 1000;
// Informix syscolumns.coltype (low byte); +256 means NOT NULL
const COLTYPES = {
    0: "char",
    1: "smallint",
    2: "integer",
    3: "float",
    5: "decimal",
    6: "serial",
    7: "date",
    10: "datetime",
    13: "varchar",
    14: "interval",
    15: "nchar",
    16: "nvarchar",
    17: "int8",
    40: "lvarchar",
    41: "boolean",
    52: "bigint",
    53: "bigserial",
};
export class UnknownClusterError extends Error {
}
function errorMessage(err) {
    const e = err;
    return e?.root?.Envelope?.Body?.Fault?.faultstring || e?.message || String(err);
}
/** AXL returns {row: [...]}, {row: {...}} for one row, or nothing for zero rows. */
function normalizeRows(result) {
    const r = result;
    const raw = r?.row ?? r?.return?.row;
    const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
    const columns = [];
    const seen = new Set();
    const rows = list.map((item) => {
        const row = {};
        for (const [k, v] of Object.entries(item)) {
            if (!seen.has(k)) {
                seen.add(k);
                columns.push(k);
            }
            row[k] = v === undefined || v === null ? "" : String(v);
        }
        return row;
    });
    return { columns, rows };
}
function withTimeout(p, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${Math.round(ms / 1000)}s`)), ms);
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}
/**
 * cisco-axl adds a "soapError" listener to its cached SOAP client on every call and never removes it,
 * so a long-running server leaks listeners (MaxListenersExceededWarning). Once no call is in flight
 * for this client, those listeners are dead and can be dropped.
 */
export function withListenerCleanup(svc) {
    let inFlight = 0;
    return {
        async executeSqlQuery(sql) {
            inFlight++;
            try {
                return await svc.executeSqlQuery(sql);
            }
            finally {
                if (--inFlight === 0)
                    svc._soapClient?.removeAllListeners?.("soapError");
            }
        },
    };
}
const defaultFactory = (c) => withListenerCleanup(new axlService(c.hostname, c.username, c.password, c.version));
export class ClusterRunner {
    clusters;
    timeoutMs;
    clientFactory;
    clients = new Map();
    schemas = new Map();
    constructor(clusters, timeoutMs, clientFactory = defaultFactory) {
        this.clusters = clusters;
        this.timeoutMs = timeoutMs;
        this.clientFactory = clientFactory;
    }
    has(clusterId) {
        return this.clusters.some((c) => c.id === clusterId);
    }
    client(clusterId) {
        const cluster = this.clusters.find((c) => c.id === clusterId);
        if (!cluster)
            throw new UnknownClusterError(`Unknown cluster "${clusterId}"`);
        let client = this.clients.get(clusterId);
        if (!client) {
            client = this.clientFactory(cluster);
            this.clients.set(clusterId, client);
        }
        return client;
    }
    async query(clusterId, sql) {
        return normalizeRows(await withTimeout(this.client(clusterId).executeSqlQuery(sql), this.timeoutMs));
    }
    async runOne(sql, clusterId) {
        const started = Date.now();
        try {
            const { columns, rows } = await this.query(clusterId, sql);
            return { clusterId, status: "ok", columns, rows, rowCount: rows.length, durationMs: Date.now() - started };
        }
        catch (err) {
            if (err instanceof UnknownClusterError)
                throw err;
            const message = errorMessage(err);
            const throttle = parseThrottle(message);
            return {
                clusterId,
                status: throttle ? "throttled" : "error",
                columns: [],
                rows: [],
                rowCount: 0,
                durationMs: Date.now() - started,
                error: message,
                ...(throttle ? { throttle } : {}),
            };
        }
    }
    run(sql, clusterIds) {
        for (const id of clusterIds)
            if (!this.has(id))
                throw new UnknownClusterError(`Unknown cluster "${id}"`);
        return Promise.all(clusterIds.map((id) => this.runOne(sql, id)));
    }
    async test(clusterId) {
        const started = Date.now();
        try {
            await this.query(clusterId, "select first 1 name from processnode");
            const latencyMs = Date.now() - started;
            try {
                const { rows } = await this.query(clusterId, "select first 1 version from componentversion where softwarecomponent = 'master'");
                return rows[0]?.version ? { ok: true, latencyMs, version: rows[0].version } : { ok: true, latencyMs };
            }
            catch {
                return { ok: true, latencyMs };
            }
        }
        catch (err) {
            if (err instanceof UnknownClusterError)
                throw err;
            return { ok: false, latencyMs: Date.now() - started, error: errorMessage(err) };
        }
    }
    async schema(clusterId) {
        const cached = this.schemas.get(clusterId);
        if (cached && Date.now() - cached.at < SCHEMA_TTL_MS)
            return cached.schema;
        const { rows } = await this.query(clusterId, "select t.tabname, c.colname, c.coltype from systables t, syscolumns c where t.tabid = c.tabid and t.tabid > 99 and t.tabtype = 'T' order by t.tabname, c.colno");
        const schema = {};
        for (const r of rows) {
            (schema[r.tabname] ??= []).push({ name: r.colname, type: COLTYPES[Number(r.coltype) & 0xff] ?? "other" });
        }
        this.schemas.set(clusterId, { at: Date.now(), schema });
        return schema;
    }
}
//# sourceMappingURL=axl.js.map