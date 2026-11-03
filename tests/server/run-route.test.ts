import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildApp } from "../../server/app.js";
import { ActivityLog } from "../../server/activityLog.js";
import { ClusterRunner } from "../../server/axl.js";
import type { ClusterConfig } from "../../server/config.js";
import { testConfig } from "./helpers.js";

const FAULT =
  "Query request too large. Total rows matched: 2816 rows. Suggested row fetch: less than 844 rows";

const cl = (id: string): ClusterConfig => ({ id, name: id.toUpperCase(), hostname: id, username: "u", password: "p", version: "14.0" });

async function setup(opts: { apiKey?: string; throttle?: boolean } = {}) {
  const clusters = [cl("brb"), cl("lab")];
  const config = testConfig({ clusters, defaultClusterId: "brb", apiKey: opts.apiKey ?? null });
  const p = path.join(config.dataDir, "Phones", "Phones_with_DN.sql");
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, "select name, dn from phones where dn = :dn and pt = :pt=Internal");
  const seen: string[] = [];
  const runner = new ClusterRunner(clusters, 1000, (c) => ({
    executeSqlQuery: async (sql: string) => {
      seen.push(`${c.id}:${sql}`);
      if (opts.throttle) throw new Error(FAULT);
      return { row: [{ name: `SEP-${c.id}`, dn: "1234" }] };
    },
  }));
  const log = new ActivityLog(path.join(config.dataDir, ".logs"), 12);
  const app = await buildApp({ config, runner, log });
  return { app, seen, log };
}

const URL = "/api/run/Phones/Phones_with_DN";

describe("GET /api/run/*", () => {
  it("runs saved query with variables on default cluster", async () => {
    const { app, seen } = await setup();
    const res = await app.inject({ method: "GET", url: `${URL}?dn=1234` });
    expect(res.statusCode).toBe(200);
    expect(seen).toEqual(["brb:select name, dn from phones where dn = '1234' and pt = 'Internal'"]);
    expect(res.json()).toEqual({
      columns: ["name", "dn"],
      rows: [{ name: "SEP-brb", dn: "1234" }],
      clusters: [{ id: "brb", status: "ok", rowCount: 1, durationMs: expect.any(Number) }],
    });
  });

  it("multi-cluster adds cluster column", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "GET", url: `${URL}?dn=1&cluster=brb,lab` });
    expect(res.json().columns).toEqual(["cluster", "name", "dn"]);
    expect(res.json().rows.map((r: Record<string, string>) => r.cluster)).toEqual(["BRB", "LAB"]);
  });

  it("csv format", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "GET", url: `${URL}?dn=1&format=csv` });
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="Phones_with_DN.csv"');
    expect(res.body).toBe('name,dn\r\nSEP-brb,1234\r\n');
  });

  it("missing variable 400 lists names", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "GET", url: URL });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "missing_variables", missing: ["dn"], message: expect.any(String) });
  });

  it("404 for missing query", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/run/Old/Gone" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("not_found");
  });

  it("400 for unknown cluster", async () => {
    const { app } = await setup();
    expect((await app.inject({ method: "GET", url: `${URL}?dn=1&cluster=nope` })).statusCode).toBe(400);
  });

  it("api key required when set and no remote-user", async () => {
    const { app } = await setup({ apiKey: "k123" });
    expect((await app.inject({ method: "GET", url: `${URL}?dn=1` })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: `${URL}?dn=1`, headers: { authorization: "Bearer nope" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: `${URL}?dn=1`, headers: { authorization: "Bearer k123" } })).statusCode).toBe(200);
  });

  it("remote-user bypasses api key", async () => {
    const { app } = await setup({ apiKey: "k123" });
    expect((await app.inject({ method: "GET", url: `${URL}?dn=1`, headers: { "remote-user": "jw" } })).statusCode).toBe(200);
  });

  it("throttle returns 413 with counts", async () => {
    const { app } = await setup({ throttle: true });
    const res = await app.inject({ method: "GET", url: `${URL}?dn=1` });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toMatchObject({ error: "too_large", clusters: [{ id: "brb", totalRows: 2816, suggestedRows: 844 }] });
  });

  it("logs source api with caller identity", async () => {
    const { app, log } = await setup({ apiKey: "k123" });
    await app.inject({ method: "GET", url: `${URL}?dn=1`, headers: { authorization: "Bearer k123" } });
    const [e] = (await log.query({})).entries;
    expect(e).toMatchObject({ action: "run", source: "api", user: "api-key", path: "Phones/Phones_with_DN" });
    expect(e.sql).toContain("'1'");
  });
});
