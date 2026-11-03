import { AlertTriangle, CheckCircle2, Layers, XCircle } from "lucide-react";
import type { ClusterResult } from "@shared/types";
import { batchSize } from "@shared/paging";
import { Button } from "@/components/ui/button";
import type { RunState } from "@/hooks/useRun";

interface Props {
  run: RunState;
  names: Record<string, string>;
}

function Chip({ result, name, run }: { result: ClusterResult; name: string; run: RunState }) {
  if (result.status === "ok") {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs">
        <CheckCircle2 className="size-3.5 text-emerald-500" />
        <span className="font-medium">{name}</span>
        <span className="text-muted-foreground">
          {result.rowCount.toLocaleString()} rows · {result.durationMs.toLocaleString()} ms
        </span>
      </div>
    );
  }
  if (result.status === "throttled" && result.throttle) {
    const t = result.throttle;
    const size = batchSize(t);
    const batches = Math.ceil(t.totalRows / size);
    const paging = run.paginate(result.clusterId);
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs">
        <AlertTriangle className="size-3.5 text-amber-500" />
        <span className="font-medium">{name}</span>
        <span>Too large for one request: {t.totalRows.toLocaleString()} rows (UCM 8 MB limit).</span>
        {paging.ok ? (
          <Button size="xs" variant="outline" onClick={() => run.fetchAll(result.clusterId)} disabled={run.running}>
            <Layers className="size-3" /> Fetch all {t.totalRows.toLocaleString()} in {batches} batches
          </Button>
        ) : (
          <span className="text-muted-foreground">{paging.reason}</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs">
      <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
      <span className="font-medium">{name}</span>
      <span className="whitespace-pre-wrap break-words">
        {result.error}
        {result.rowCount > 0 && ` (showing ${result.rowCount.toLocaleString()} rows fetched so far)`}
      </span>
    </div>
  );
}

export function ClusterStatusChips({ run, names }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {run.results.map((r) => (
        <Chip key={r.clusterId} result={r} name={names[r.clusterId] ?? r.clusterId} run={run} />
      ))}
      {run.progress && (
        <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          Batch {run.progress.batch} · {run.progress.rows.toLocaleString()} / {run.progress.total.toLocaleString()} rows
          <Button size="xs" variant="ghost" onClick={run.cancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
