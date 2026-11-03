import axlService from "cisco-axl";
import type { ClusterConfig } from "./config.js";
import { parseThrottle, type Throttle } from "../shared/paging.js";

export type Row = Record<string, string>;

export interface ClusterResult {
  clusterId: string;
  status: "ok" | "error" | "throttled";
  columns: string[];
  rows: Row[];
  rowCount: number;
  durationMs: number;
  error?: string;
  throttle?: Throttle;
}

export interface AxlClient {
  executeSqlQuery(sql: string): Promise<unknown>;
}

export type Schema = Record<string, { name: string; type: string }[]>;

const SCHEMA_TTL_MS = 60 * 60 * 1000;

// Informix syscolumns.coltype (low byte); +256 means NOT NULL
const COLTYPES: Record<number, string> = {
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

export class UnknownClusterError extends Error {}

function errorMessage(err: unknown): string {
  const e = err as { root?: { Envelope?: { Body?: { Fault?: { faultstring?: string } } } }; message?: string };
  return e?.root?.Envelope?.Body?.Fault?.faultstring || e?.message || String(err);
}

/** AXL returns {row: [...]}, {row: {...}} for one row, or nothing for zero rows. */
function normalizeRows(result: unknown): { columns: string[]; rows: Row[] } {
  const r = result as { row?: unknown; return?: { row?: unknown } } | null | undefined;
  const raw = r?.row ?? r?.return?.row;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  const columns: string[] = [];
  const seen = new Set<string>();
  const rows = list.map((item: Record<string, unknown>) => {
    const row: Row = {};
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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

const defaultFactory = (c: ClusterConfig): AxlClient => new axlService(c.hostname, c.username, c.password, c.version);

export class ClusterRunner {
  private clients = new Map<string, AxlClient>();
  private schemas = new Map<string, { at: number; schema: Schema }>();

  constructor(
    private clusters: ClusterConfig[],
    private timeoutMs: number,
    private clientFactory: (c: ClusterConfig) => AxlClient = defaultFactory,
  ) {}

  has(clusterId: string): boolean {
    return this.clusters.some((c) => c.id === clusterId);
  }

  private client(clusterId: string): AxlClient {
    const cluster = this.clusters.find((c) => c.id === clusterId);
    if (!cluster) throw new UnknownClusterError(`Unknown cluster "${clusterId}"`);
    let client = this.clients.get(clusterId);
    if (!client) {
      client = this.clientFactory(cluster);
      this.clients.set(clusterId, client);
    }
    return client;
  }

  private async query(clusterId: string, sql: string) {
    return normalizeRows(await withTimeout(this.client(clusterId).executeSqlQuery(sql), this.timeoutMs));
  }

  async runOne(sql: string, clusterId: string): Promise<ClusterResult> {
    const started = Date.now();
    try {
      const { columns, rows } = await this.query(clusterId, sql);
      return { clusterId, status: "ok", columns, rows, rowCount: rows.length, durationMs: Date.now() - started };
    } catch (err) {
      if (err instanceof UnknownClusterError) throw err;
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

  run(sql: string, clusterIds: string[]): Promise<ClusterResult[]> {
    for (const id of clusterIds) if (!this.has(id)) throw new UnknownClusterError(`Unknown cluster "${id}"`);
    return Promise.all(clusterIds.map((id) => this.runOne(sql, id)));
  }

  async test(clusterId: string): Promise<{ ok: boolean; latencyMs: number; version?: string; error?: string }> {
    const started = Date.now();
    try {
      await this.query(clusterId, "select first 1 name from processnode");
      const latencyMs = Date.now() - started;
      try {
        const { rows } = await this.query(clusterId, "select first 1 version from componentversion where softwarecomponent = 'master'");
        return rows[0]?.version ? { ok: true, latencyMs, version: rows[0].version } : { ok: true, latencyMs };
      } catch {
        return { ok: true, latencyMs };
      }
    } catch (err) {
      if (err instanceof UnknownClusterError) throw err;
      return { ok: false, latencyMs: Date.now() - started, error: errorMessage(err) };
    }
  }

  async schema(clusterId: string): Promise<Schema> {
    const cached = this.schemas.get(clusterId);
    if (cached && Date.now() - cached.at < SCHEMA_TTL_MS) return cached.schema;
    const { rows } = await this.query(
      clusterId,
      "select t.tabname, c.colname, c.coltype from systables t, syscolumns c where t.tabid = c.tabid and t.tabid > 99 and t.tabtype = 'T' order by t.tabname, c.colno",
    );
    const schema: Schema = {};
    for (const r of rows) {
      (schema[r.tabname] ??= []).push({ name: r.colname, type: COLTYPES[Number(r.coltype) & 0xff] ?? "other" });
    }
    this.schemas.set(clusterId, { at: Date.now(), schema });
    return schema;
  }
}
