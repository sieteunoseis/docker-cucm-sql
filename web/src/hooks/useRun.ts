import { useCallback, useRef, useState } from "react";
import type { ClusterResult } from "@shared/types";
import { api } from "@/api/client";

export interface RunState {
  results: ClusterResult[];
  running: boolean;
  error: string | null;
  run: (sql: string, clusters: string[], path?: string) => Promise<void>;
  cancel: () => void;
}

export function useRun(): RunState {
  const [results, setResults] = useState<ClusterResult[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (sql: string, clusters: string[], path?: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setError(null);
    try {
      const res = await api.runQuery({ sql, clusters, path }, ctrl.signal);
      if (!ctrl.signal.aborted) setResults(res.results);
    } catch (err) {
      if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abortRef.current === ctrl) setRunning(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  return { results, running, error, run, cancel };
}
