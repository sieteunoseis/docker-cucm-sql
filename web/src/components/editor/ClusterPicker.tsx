import { useEffect, useState } from "react";
import type { ClusterTest, PublicCluster } from "@shared/types";
import { api } from "@/api/client";
import { cn } from "@/lib/utils";

interface Props {
  clusters: PublicCluster[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function ClusterPicker({ clusters, selected, onChange }: Props) {
  const [status, setStatus] = useState<Record<string, ClusterTest | "error">>({});

  useEffect(() => {
    let cancelled = false;
    for (const c of clusters) {
      api
        .testCluster(c.id)
        .then((t) => !cancelled && setStatus((s) => ({ ...s, [c.id]: t })))
        .catch(() => !cancelled && setStatus((s) => ({ ...s, [c.id]: "error" })));
    }
    return () => {
      cancelled = true;
    };
  }, [clusters]);

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    // keep config order so the cluster column is stable
    if (next.length) onChange(clusters.map((c) => c.id).filter((c) => next.includes(c)));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Clusters">
      {clusters.map((c) => {
        const s = status[c.id];
        const on = selected.includes(c.id);
        const title =
          s === undefined
            ? "Checking connection…"
            : s === "error" || !s.ok
              ? `Unreachable: ${s === "error" ? "request failed" : s.error}`
              : `OK · ${s.latencyMs} ms${s.version ? ` · CUCM ${s.version}` : ""}`;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(c.id)}
            title={`${c.hostname} — ${title}`}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
              on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                s === undefined ? "bg-muted-foreground/40" : s !== "error" && s.ok ? "bg-emerald-500" : "bg-red-500",
              )}
            />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
