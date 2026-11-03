import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { encodePath } from "@/api/client";

export interface UrlState {
  path: string | null;
  clusters: string[];
  vars: Record<string, string>;
  autorun: boolean;
  /** id of a Log entry whose SQL should be opened (handed over via sessionStorage) */
  openId: string | null;
}

const RESERVED = new Set(["cluster", "run", "open"]);

export function parseUrl(pathname: string, search: string): UrlState {
  const params = new URLSearchParams(search);
  const m = /^\/q\/(.+)$/.exec(pathname);
  const path = m ? m[1].split("/").filter(Boolean).map(decodeURIComponent).join("/") : null;
  const vars: Record<string, string> = {};
  for (const [k, v] of params) if (!RESERVED.has(k)) vars[k] = v;
  return {
    path: path || null,
    clusters: (params.get("cluster") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    vars,
    autorun: params.get("run") === "1",
    openId: params.get("open"),
  };
}

export function buildLink(origin: string, state: { path: string; clusters: string[]; vars: Record<string, string> }): string {
  const params = new URLSearchParams();
  if (state.clusters.length) params.set("cluster", state.clusters.join(","));
  for (const [k, v] of Object.entries(state.vars)) if (v) params.set(k, v);
  const qs = params.toString();
  return `${origin}/q/${encodePath(state.path)}${qs ? `?${qs}` : ""}`;
}

export function useUrlState(): UrlState {
  const { pathname, search } = useLocation();
  return useMemo(() => parseUrl(pathname, search), [pathname, search]);
}
