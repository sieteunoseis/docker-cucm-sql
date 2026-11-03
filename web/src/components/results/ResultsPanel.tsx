import { useMemo } from "react";
import type { PublicCluster } from "@shared/types";
import type { RunState } from "@/hooks/useRun";
import { mergeResults } from "@/lib/results";
import { ClusterStatusChips } from "./ClusterStatusChips";
import { ResultsGrid } from "./ResultsGrid";

interface Props {
  run: RunState;
  clusters: PublicCluster[];
  queryName: string | null;
}

export function ResultsPanel({ run, clusters, queryName }: Props) {
  const names = useMemo(() => Object.fromEntries(clusters.map((c) => [c.id, c.name])), [clusters]);
  const merged = useMemo(() => mergeResults(run.results, names), [run.results, names]);

  if (run.error) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">{run.error}</div>;
  }
  if (!run.results.length) return null;

  return (
    <div className="space-y-3">
      <ClusterStatusChips run={run} names={names} />
      {merged.rows.length > 0 ? (
        <ResultsGrid key={merged.columns.join("|")} columns={merged.columns} rows={merged.rows} queryName={queryName} />
      ) : (
        run.results.every((r) => r.status === "ok") && <p className="text-sm text-muted-foreground">No rows returned.</p>
      )}
    </div>
  );
}
