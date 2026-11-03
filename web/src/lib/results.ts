import type { ClusterResult, Row } from "@shared/types";

/** One grid for all clusters; with more than one, each row is tagged with its cluster's name. */
export function mergeResults(results: ClusterResult[], names: Record<string, string>): { columns: string[]; rows: Row[] } {
  const multi = results.length > 1;
  const columns: string[] = [];
  for (const r of results) for (const c of r.columns) if (!columns.includes(c)) columns.push(c);
  if (!multi) return { columns, rows: results[0]?.rows ?? [] };
  const tag = columns.includes("cluster") ? "cucm_cluster" : "cluster";
  return {
    columns: [tag, ...columns],
    rows: results.flatMap((r) => r.rows.map((row) => ({ [tag]: names[r.clusterId] ?? r.clusterId, ...row }))),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function csvFilename(queryPath: string | null, now = new Date()): string {
  const base = queryPath?.split("/").pop() || "query";
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${base}-${stamp}.csv`;
}
