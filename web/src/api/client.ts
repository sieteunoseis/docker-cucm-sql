import type {
  AppInfo,
  ClusterResult,
  ClusterTest,
  LogAction,
  LogEntry,
  PublicCluster,
  Schema,
  TreeNode,
} from "@shared/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public body?: Record<string, unknown>,
  ) {
    super(message);
  }
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (res.status === 204) return null as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.message || body.error || `Request failed (${res.status})`, body.error, body);
  }
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export interface LogFilters {
  user?: string;
  action?: LogAction | "";
  q?: string;
  from?: string;
  to?: string;
  cursor?: string;
}

export const api = {
  getInfo: () => apiFetch<AppInfo>("/api/info"),
  getClusters: () => apiFetch<PublicCluster[]>("/api/clusters"),
  testCluster: (id: string) => apiFetch<ClusterTest>(`/api/clusters/${encodeURIComponent(id)}/test`),
  getSchema: (id: string) => apiFetch<{ tables: Schema }>(`/api/schema?cluster=${encodeURIComponent(id)}`),

  runQuery: (body: { sql: string; clusters: string[]; path?: string }, signal?: AbortSignal) =>
    apiFetch<{ results: ClusterResult[] }>("/api/query", { ...json("POST", body), signal }),

  getTree: () => apiFetch<{ tree: TreeNode[] }>("/api/queries"),
  readQuery: (path: string) => apiFetch<{ path: string; sql: string }>(`/api/queries/${encodePath(path)}`),
  /** create: refuse (409) instead of replacing an existing query */
  saveQuery: (path: string, sql: string, opts: { create?: boolean } = {}) =>
    apiFetch<{ path: string }>(`/api/queries/${encodePath(path)}${opts.create ? "?create=1" : ""}`, json("PUT", { sql })),
  moveQuery: (from: string, to: string) => apiFetch<{ path: string }>("/api/queries/move", json("POST", { from, to })),
  duplicateQuery: (from: string, to: string) => apiFetch<{ path: string }>("/api/queries/duplicate", json("POST", { from, to })),
  deleteQuery: (path: string) => apiFetch<{ deleted: string[] }>(`/api/queries/${encodePath(path)}`, { method: "DELETE" }),
  countQueries: (path: string) => apiFetch<{ count: number }>(`/api/queries-count/${encodePath(path)}`),
  createFolder: (path: string) => apiFetch<{ path: string }>("/api/folders", json("POST", { path })),

  getLog: (filters: LogFilters) => {
    const qs = new URLSearchParams(
      Object.entries(filters).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""),
    ).toString();
    return apiFetch<{ entries: LogEntry[]; nextCursor: string | null }>(`/api/log${qs ? `?${qs}` : ""}`);
  },
};
