import { useCallback, useRef, useState } from "react";
import type { ClusterResult, Row } from "@shared/types";
import { batchSize, canPaginate, pageSql } from "@shared/paging";
import { api } from "@/api/client";

export interface BatchProgress {
  clusterId: string;
  batch: number;
  rows: number;
  total: number;
}

export interface RunState {
  results: ClusterResult[];
  running: boolean;
  error: string | null;
  progress: BatchProgress | null;
  run: (sql: string, clusters: string[], path?: string) => Promise<void>;
  /** re-fetch a throttled cluster's result in SKIP/FIRST batches */
  fetchAll: (clusterId: string) => Promise<void>;
  paginate: (clusterId: string) => ReturnType<typeof canPaginate>;
  cancel: () => void;
}

export function useRun({ maxBatches }: { maxBatches: number }): RunState {
  const [results, setResults] = useState<ClusterResult[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const lastRef = useRef<{ sql: string; path?: string; results: ClusterResult[] }>({ sql: "", results: [] });

  const setAll = (next: ClusterResult[]) => {
    lastRef.current.results = next;
    setResults(next);
  };

  const run = useCallback(async (sql: string, clusters: string[], path?: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    cancelledRef.current = false;
    lastRef.current = { sql, path, results: lastRef.current.results };
    setRunning(true);
    setError(null);
    setProgress(null);
    try {
      const res = await api.runQuery({ sql, clusters, path }, ctrl.signal);
      if (!ctrl.signal.aborted) setAll(res.results);
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === ctrl) setRunning(false);
    }
  }, []);

  const fetchAll = useCallback(
    async (clusterId: string) => {
      const { sql, path } = lastRef.current;
      const target = lastRef.current.results.find((r) => r.clusterId === clusterId);
      if (!target?.throttle || !canPaginate(sql).ok) return;

      const total = target.throttle.totalRows;
      let size = batchSize(target.throttle);
      let skip = 0;
      let batches = 0;
      const rows: Row[] = [];
      const columns: string[] = [];
      const started = Date.now();
      let stopReason: string | null = null;

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      cancelledRef.current = false;
      setRunning(true);
      try {
        while (skip < total) {
          if (cancelledRef.current) {
            stopReason = `Cancelled after ${rows.length.toLocaleString()} of ${total.toLocaleString()} rows`;
            break;
          }
          if (batches >= maxBatches) {
            stopReason = `Stopped after ${maxBatches} batches (${rows.length.toLocaleString()} of ${total.toLocaleString()} rows)`;
            break;
          }
          setProgress({ clusterId, batch: batches + 1, rows: rows.length, total });
          const res = await api.runQuery({ sql: pageSql(sql, skip, size), clusters: [clusterId], path }, ctrl.signal);
          batches++;
          const r = res.results[0];
          if (r.status === "throttled") {
            size = Math.max(1, Math.floor(size / 2));
            continue;
          }
          if (r.status === "error") {
            stopReason = r.error ?? "Batch failed";
            break;
          }
          for (const c of r.columns) if (!columns.includes(c)) columns.push(c);
          rows.push(...r.rows);
          if (r.rowCount < size) break;
          skip += size;
        }
      } catch (err) {
        stopReason = cancelledRef.current ? `Cancelled after ${rows.length.toLocaleString()} rows` : (err as Error).message;
      } finally {
        setRunning(false);
        setProgress(null);
      }

      const merged: ClusterResult = {
        clusterId,
        status: stopReason ? "error" : "ok",
        columns,
        rows,
        rowCount: rows.length,
        durationMs: Date.now() - started,
        ...(stopReason ? { error: stopReason } : {}),
      };
      setAll(lastRef.current.results.map((r) => (r.clusterId === clusterId ? merged : r)));
    },
    [maxBatches],
  );

  const paginate = useCallback(() => canPaginate(lastRef.current.sql), []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  return { results, running, error, progress, run, fetchAll, paginate, cancel };
}
