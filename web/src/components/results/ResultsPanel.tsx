import type { PublicCluster } from "@shared/types";
import type { RunState } from "@/hooks/useRun";

interface Props {
  run: RunState;
  sql: string;
  clusters: PublicCluster[];
  queryName: string | null;
}

export function ResultsPanel({ run }: Props) {
  if (run.error) return <p className="text-sm text-destructive">{run.error}</p>;
  return (
    <ul className="text-sm text-muted-foreground">
      {run.results.map((r) => (
        <li key={r.clusterId}>
          {r.clusterId}: {r.status} · {r.rowCount} rows
        </li>
      ))}
    </ul>
  );
}
