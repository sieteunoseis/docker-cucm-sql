import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import type { LogAction, LogEntry } from "@shared/types";
import { api, encodePath, type LogFilters } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { OPEN_KEY_PREFIX } from "@/lib/links";

const ACTIONS: { value: LogAction; label: string }[] = [
  { value: "run", label: "Run" },
  { value: "save", label: "Save" },
  { value: "move", label: "Move / rename" },
  { value: "duplicate", label: "Duplicate" },
  { value: "delete", label: "Delete" },
  { value: "folder_create", label: "New folder" },
];

const ACTION_STYLE: Record<LogAction, string> = {
  run: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  save: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  move: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  duplicate: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  delete: "bg-red-500/15 text-red-700 dark:text-red-300",
  folder_create: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

const FILTER_KEYS = ["user", "action", "q", "from", "to"] as const;

/** Open SQL in a new editor tab; unsaved SQL never goes in a URL, so it's handed over via sessionStorage. */
function openInEditor(key: string, sql: string) {
  try {
    sessionStorage.setItem(OPEN_KEY_PREFIX + key, sql);
  } catch {
    /* storage unavailable: the tab opens empty */
  }
  window.open(`/?open=${encodeURIComponent(key)}`, "_blank");
}

function SqlCell({ sql }: { sql: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = sql.length > 120;
  return (
    <div className="font-mono text-xs">
      <span className="whitespace-pre-wrap break-all">{expanded || !long ? sql : `${sql.slice(0, 120)}…`}</span>
      {long && (
        <button type="button" className="ml-1 text-muted-foreground underline" onClick={() => setExpanded(!expanded)}>
          {expanded ? "less" : "more"}
        </button>
      )}
    </div>
  );
}

function EntryRow({ e }: { e: LogEntry }) {
  const deleted = e.deletedSql ? Object.entries(e.deletedSql) : [];
  return (
    <tr className="border-b border-border/60 align-top">
      <td className="whitespace-nowrap px-2 py-1.5 text-xs text-muted-foreground" title={e.ts}>
        {new Date(e.ts).toLocaleString()}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5">{e.user}</td>
      <td className="px-2 py-1.5">
        <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", ACTION_STYLE[e.action])}>{e.action.replace("_", " ")}</span>
        {e.source === "api" && <span className="ml-1 text-xs text-muted-foreground">api</span>}
      </td>
      <td className="px-2 py-1.5">
        {e.path &&
          (e.action === "delete" ? (
            <span>{e.path}</span>
          ) : (
            <Link to={`/q/${encodePath(e.to ?? e.path)}`} className="hover:underline">
              {e.path}
            </Link>
          ))}
        {e.to && <span className="text-muted-foreground"> → {e.to}</span>}
      </td>
      <td className="px-2 py-1.5 text-xs">
        {e.clusters?.map((c) => (
          <div key={c.id} className={c.status === "ok" ? "" : "text-destructive"} title={c.error}>
            {c.id}: {c.status === "ok" ? `${c.rowCount.toLocaleString()} rows · ${c.durationMs} ms` : c.status}
          </div>
        ))}
      </td>
      <td className="max-w-xl px-2 py-1.5">
        {e.sql && <SqlCell sql={e.sql} />}
        {deleted.length > 0 && (
          <div className="space-y-1">
            {deleted.map(([p, sql], i) => (
              <Button key={p} size="xs" variant="outline" onClick={() => openInEditor(`${e.id}-${i}`, sql)}>
                <ExternalLink className="size-3" /> Restore {p}
              </Button>
            ))}
          </div>
        )}
      </td>
      <td className="px-2 py-1.5">
        {e.action === "run" && e.sql && (
          <Button size="xs" variant="ghost" onClick={() => openInEditor(e.id, e.sql!)} aria-label="Open in editor" title="Open in editor">
            <ExternalLink className="size-3.5" />
          </Button>
        )}
      </td>
    </tr>
  );
}

export function LogPage() {
  const [params, setParams] = useSearchParams();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState({ user: params.get("user") ?? "", q: params.get("q") ?? "" });

  const filters: LogFilters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ""]));
  const filterKey = FILTER_KEYS.map((k) => params.get(k) ?? "").join("\u0000");

  const setFilter = (key: (typeof FILTER_KEYS)[number], value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // text filters reach the URL (and the server) after a pause in typing
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      for (const k of ["user", "q"] as const) {
        if (text[k]) next.set(k, text[k]);
        else next.delete(k);
      }
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [text, params, setParams]);

  useEffect(() => {
    let cancelled = false;
    api
      .getLog(filters)
      .then((res) => {
        if (cancelled) return;
        setEntries(res.entries);
        setCursor(res.nextCursor);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
    // filters is rebuilt every render; filterKey captures its content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    try {
      const res = await api.getLog({ ...filters, cursor });
      setEntries((prev) => [...prev, ...res.entries]);
      setCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>User</span>
          <Input value={text.user} onChange={(e) => setText({ ...text, user: e.target.value })} className="h-8 w-40" />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Action</span>
          <select
            aria-label="Action"
            value={params.get("action") ?? ""}
            onChange={(e) => setFilter("action", e.target.value)}
            className="block h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
          >
            <option value="">All</option>
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Search SQL / query / user</span>
          <Input value={text.q} onChange={(e) => setText({ ...text, q: e.target.value })} className="h-8 w-64" />
        </label>
        {(["from", "to"] as const).map((k) => (
          <label key={k} className="space-y-1 text-xs text-muted-foreground">
            <span>{k === "from" ? "From" : "To"}</span>
            <Input type="date" value={params.get(k) ?? ""} onChange={(e) => setFilter(k, e.target.value)} className="h-8 w-40" />
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs">
            <tr>
              {["Time", "User", "Action", "Query", "Clusters", "SQL", ""].map((h) => (
                <th key={h} className="px-2 py-1.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <EntryRow key={e.id} e={e} />
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                  No activity matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {cursor && (
        <Button variant="outline" onClick={loadMore} disabled={loading}>
          Load more
        </Button>
      )}
    </div>
  );
}
