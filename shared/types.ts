// API data shapes shared by the server and the web UI.
import type { Throttle } from "./paging.js";

export type Row = Record<string, string>;

export interface PublicCluster {
  id: string;
  name: string;
  hostname: string;
  version: string;
}

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

export interface ClusterTest {
  ok: boolean;
  latencyMs: number;
  version?: string;
  error?: string;
}

export type Schema = Record<string, { name: string; type: string }[]>;

export interface TreeNode {
  type: "folder" | "query";
  name: string;
  path: string;
  description?: string;
  children?: TreeNode[];
}

export type LogAction = "run" | "save" | "move" | "duplicate" | "delete" | "folder_create";

export interface LogEntry {
  id: string;
  ts: string;
  user: string;
  action: LogAction;
  source: "ui" | "api";
  path?: string;
  to?: string;
  sql?: string;
  deletedSql?: Record<string, string>;
  clusters?: { id: string; status: string; rowCount: number; durationMs: number; error?: string }[];
}

export interface AppInfo {
  version: string;
  imageTag: string | null;
  clusterCount: number;
  maxBatches: number;
}
