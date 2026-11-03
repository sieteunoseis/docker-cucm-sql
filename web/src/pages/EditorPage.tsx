import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Eraser, Loader2, Play, Save, Square, WandSparkles } from "lucide-react";
import type { PublicCluster } from "@shared/types";
import { extractVariables, missingVariables, resolveVariables } from "@shared/variables";
import { formatForSave } from "@shared/formatSql";
import { api, ApiError, encodePath } from "@/api/client";
import { Button } from "@/components/ui/button";
import { QueryTree } from "@/components/sidebar/QueryTree";
import { SqlEditor } from "@/components/editor/SqlEditor";
import { ClusterPicker } from "@/components/editor/ClusterPicker";
import { VariablesBar } from "@/components/editor/VariablesBar";
import { SaveDialog } from "@/components/editor/SaveDialog";
import { CommandPalette, type PaletteAction } from "@/components/palette/CommandPalette";
import { ResultsPanel } from "@/components/results/ResultsPanel";
import { useQueryTree } from "@/hooks/useQueryTree";
import { useUrlState, buildLink } from "@/hooks/useUrlState";
import { useSchema } from "@/hooks/useSchema";
import { useRun } from "@/hooks/useRun";
import { useTheme } from "@/hooks/useTheme";

export const OPEN_KEY_PREFIX = "cucm-sql:open:";

function takeHandedSql(openId: string | null): string | null {
  if (!openId) return null;
  try {
    return sessionStorage.getItem(OPEN_KEY_PREFIX + openId);
  } catch {
    return null;
  }
}

const folderOf = (p: string | null) => (p && p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");

export function EditorPage() {
  const navigate = useNavigate();
  const url = useUrlState();
  const { tree, refresh } = useQueryTree();
  const { toggle: toggleTheme } = useTheme();
  const [maxBatches, setMaxBatches] = useState(200);
  const run = useRun({ maxBatches });

  const [clusters, setClusters] = useState<PublicCluster[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  // SQL handed over from the Log page (?open=<id>) seeds a fresh tab
  const [sql, setSql] = useState(() => takeHandedSql(url.openId) ?? "");
  const [loadedState, setLoaded] = useState<{ path: string; sql: string } | null>(null);
  const [notFoundState, setNotFound] = useState<string | null>(null);
  const [vars, setVars] = useState<Record<string, string>>(url.vars);
  const [saveOpen, setSaveOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const autoRan = useRef(false);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }, []);

  useEffect(() => {
    api.getInfo().then((info) => setMaxBatches(info.maxBatches)).catch(() => {});
  }, []);

  // clusters: URL selection if valid, else the default (first)
  useEffect(() => {
    api.getClusters().then((list) => {
      setClusters(list);
      const fromUrl = url.clusters.filter((id) => list.some((c) => c.id === id));
      setSelected(fromUrl.length ? fromUrl : list.slice(0, 1).map((c) => c.id));
    });
    // only on first load; later URL changes don't override the picker
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // only meaningful while the URL still names that query
  const loaded = url.path && loadedState?.path === url.path ? loadedState : null;
  const notFound = url.path && notFoundState === url.path ? notFoundState : null;

  // load the query named in the URL
  useEffect(() => {
    let cancelled = false;
    if (!url.path) return;
    api
      .readQuery(url.path)
      .then((res) => {
        if (cancelled) return;
        setSql(res.sql);
        setLoaded(res);
        setNotFound(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoaded(null);
        setSql("");
        setNotFound(err instanceof ApiError && err.status === 404 ? url.path : null);
        if (!(err instanceof ApiError && err.status === 404)) flash(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [url.path, flash]);

  useEffect(() => {
    if (!url.openId) return;
    try {
      sessionStorage.removeItem(OPEN_KEY_PREFIX + url.openId);
    } catch {
      /* storage unavailable */
    }
    navigate("/", { replace: true });
  }, [url.openId, navigate]);

  const schema = useSchema(selected[0] ?? null);
  const missing = useMemo(() => missingVariables(sql, vars), [sql, vars]);
  const dirty = loaded ? sql !== loaded.sql : false;

  const doRun = useCallback(() => {
    if (!sql.trim() || missing.length || !selected.length) return;
    run.run(resolveVariables(sql, vars), selected, loaded?.path);
  }, [sql, vars, missing, selected, loaded, run]);

  // ?run=1 runs once, after the query and the clusters are in
  useEffect(() => {
    if (!url.autorun || autoRan.current || !selected.length) return;
    if (url.path && loaded?.path !== url.path) return;
    autoRan.current = true;
    doRun();
  }, [url.autorun, url.path, loaded, selected, doRun]);

  const saveTo = useCallback(
    async (path: string) => {
      const res = await api.saveQuery(path, sql);
      const saved = await api.readQuery(res.path);
      setSql(saved.sql);
      setLoaded(saved);
      refresh();
      if (res.path !== url.path) navigate(`/q/${encodePath(res.path)}`);
      flash(`Saved ${res.path}`);
    },
    [sql, refresh, navigate, url.path, flash],
  );

  const doSave = useCallback(() => {
    if (!sql.trim()) return;
    if (loaded) saveTo(loaded.path).catch((err) => flash(err.message));
    else setSaveOpen(true);
  }, [sql, loaded, saveTo, flash]);

  const doFormat = useCallback(() => setSql((s) => formatForSave(s)), []);

  const doClear = useCallback(() => {
    setSql("");
    setLoaded(null);
    setVars({});
    navigate("/");
  }, [navigate]);

  const copyLink = useCallback(async () => {
    if (!loaded) return;
    const defaults = new Map(extractVariables(sql).map((v) => [v.name, v.defaultValue]));
    const linkVars = Object.fromEntries(Object.entries(vars).filter(([k, v]) => v && v !== defaults.get(k) && defaults.has(k)));
    const link = buildLink(window.location.origin, { path: loaded.path, clusters: selected, vars: linkVars });
    try {
      await navigator.clipboard.writeText(link);
      flash("Link copied");
    } catch {
      window.prompt("Copy link", link);
    }
  }, [loaded, sql, vars, selected, flash]);

  const openQuery = useCallback((path: string) => navigate(`/q/${encodePath(path)}`), [navigate]);

  // Ctrl/Cmd+K anywhere on the page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const actions: PaletteAction[] = [
    { id: "run", label: "Run query", run: doRun },
    { id: "format", label: "Format SQL", run: doFormat },
    { id: "save", label: "Save", run: doSave },
    { id: "new", label: "New query", run: doClear },
    { id: "log", label: "Go to Log", run: () => navigate("/log") },
    { id: "theme", label: "Toggle theme", run: toggleTheme },
  ];

  const handleMoved = (from: string, to: string) => {
    if (!loaded) return;
    if (loaded.path === from) openQuery(to);
    else if (loaded.path.startsWith(`${from}/`)) openQuery(to + loaded.path.slice(from.length));
  };

  const handleDeleted = (paths: string[]) => {
    if (loaded && paths.includes(loaded.path)) {
      setLoaded(null);
      navigate("/");
      flash(`Deleted ${loaded.path}`);
    }
  };

  const runBlocked = !sql.trim() || missing.length > 0 || !selected.length;

  return (
    <div className="flex gap-6">
      <aside className="w-64 shrink-0">
        <QueryTree
          tree={tree}
          selectedPath={loaded?.path ?? null}
          onOpen={openQuery}
          onChanged={refresh}
          onMoved={handleMoved}
          onDeleted={handleDeleted}
        />
      </aside>
      <div className="min-w-0 flex-1 space-y-4">
        {notFound && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm">Query not found: {notFound}</div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="truncate text-sm font-medium">
            {loaded ? loaded.path : "Untitled query"}
            {dirty && <span className="ml-1 text-muted-foreground">• unsaved</span>}
          </h1>
          <ClusterPicker clusters={clusters} selected={selected} onChange={setSelected} />
        </div>
        <SqlEditor value={sql} onChange={setSql} schema={schema} readOnly={run.running} onRun={doRun} onSave={doSave} />
        <VariablesBar sql={sql} values={vars} onChange={setVars} />
        <div className="flex flex-wrap items-center gap-2">
          {run.running ? (
            <Button variant="destructive" onClick={run.cancel}>
              <Square className="size-4" /> Cancel
            </Button>
          ) : (
            <Button
              onClick={doRun}
              disabled={runBlocked}
              title={missing.length ? `Fill in ${missing.map((m) => `:${m}`).join(", ")}` : "Ctrl+Enter"}
            >
              <Play className="size-4" /> Run
            </Button>
          )}
          <Button variant="outline" onClick={doFormat} disabled={!sql.trim() || run.running}>
            <WandSparkles className="size-4" /> Format
          </Button>
          <Button variant="outline" onClick={doSave} disabled={!sql.trim() || run.running} title="Ctrl+S">
            <Save className="size-4" /> {loaded ? "Save" : "Save…"}
          </Button>
          {loaded && (
            <Button variant="outline" onClick={() => setSaveOpen(true)} disabled={!sql.trim()}>
              Save as…
            </Button>
          )}
          <Button variant="ghost" onClick={copyLink} disabled={!loaded} title={loaded ? "Copy a link to this query" : "Save the query to get a link"}>
            <Copy className="size-4" /> Copy link
          </Button>
          <Button variant="ghost" onClick={doClear} disabled={run.running}>
            <Eraser className="size-4" /> Clear
          </Button>
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {run.running && <Loader2 className="size-3.5 animate-spin" />}
            {notice ?? "Ctrl+Enter run · Ctrl+S save · Ctrl+K search"}
          </span>
        </div>
        <ResultsPanel run={run} clusters={clusters} queryName={loaded?.path ?? null} />
      </div>
      {saveOpen && <SaveDialog tree={tree} initialFolder={folderOf(loaded?.path ?? null)} onSave={saveTo} onClose={() => setSaveOpen(false)} />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} tree={tree} actions={actions} onOpenQuery={openQuery} />
    </div>
  );
}
