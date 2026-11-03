import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ActivityLog } from "../../server/activityLog.js";
import { identityFrom } from "../../server/identity.js";
import { ClusterRunner } from "../../server/axl.js";
import { buildApp } from "../../server/app.js";
import { testConfig } from "./helpers.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "log-"));
});

describe("identityFrom", () => {
  it("prefers remote-user, then name, then email, else anonymous", () => {
    expect(identityFrom({ "remote-user": "jw", "remote-email": "e@x" })).toBe("jw");
    expect(identityFrom({ "remote-name": "J W" })).toBe("J W");
    expect(identityFrom({ "remote-email": "e@x" })).toBe("e@x");
    expect(identityFrom({})).toBe("anonymous");
  });
});

describe("ActivityLog", () => {
  it("append writes month file", async () => {
    const log = new ActivityLog(path.join(dir, ".logs"), 12, () => new Date("2026-11-03T12:00:00Z"));
    const e = await log.append({ user: "jw", action: "save", source: "ui", path: "a" });
    expect(e.ts).toBe("2026-11-03T12:00:00.000Z");
    const lines = readFileSync(path.join(dir, ".logs", "2026-11.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ user: "jw", action: "save", path: "a" });
  });

  it("query newest first across months with cursor paging", async () => {
    let now = new Date("2026-10-01T00:00:00Z");
    const log = new ActivityLog(path.join(dir, ".logs"), 12, () => now);
    const names = ["O1", "O2", "O3", "N1", "N2"];
    for (const [i, n] of names.entries()) {
      now = new Date(Date.UTC(2026, i < 3 ? 9 : 10, 1 + i));
      await log.append({ user: "u", action: "save", source: "ui", path: n });
    }
    const pages: string[][] = [];
    let cursor: string | undefined;
    for (;;) {
      const r = await log.query({ limit: 2, cursor });
      pages.push(r.entries.map((e) => e.path!));
      if (!r.nextCursor) break;
      cursor = r.nextCursor;
    }
    expect(pages).toEqual([["N2", "N1"], ["O3", "O2"], ["O1"]]);
  });

  it("filters by user, action, text and date", async () => {
    let now = new Date("2026-11-01T00:00:00Z");
    const log = new ActivityLog(path.join(dir, ".logs"), 12, () => now);
    await log.append({ user: "alice", action: "run", source: "ui", sql: "select * from device" });
    now = new Date("2026-11-02T00:00:00Z");
    await log.append({ user: "bob", action: "save", source: "ui", path: "Phones/x" });
    now = new Date("2026-11-03T00:00:00Z");
    await log.append({ user: "alice", action: "delete", source: "ui", path: "old" });

    const paths = async (f: Parameters<ActivityLog["query"]>[0]) => (await log.query(f)).entries.map((e) => e.user + ":" + e.action);
    expect(await paths({ user: "alice" })).toEqual(["alice:delete", "alice:run"]);
    expect(await paths({ action: "save" })).toEqual(["bob:save"]);
    expect(await paths({ q: "DEVICE" })).toEqual(["alice:run"]);
    expect(await paths({ q: "phones" })).toEqual(["bob:save"]);
    expect(await paths({ from: "2026-11-02", to: "2026-11-02" })).toEqual(["bob:save"]);
  });

  it("skips corrupt lines instead of failing", async () => {
    mkdirSync(path.join(dir, ".logs"));
    writeFileSync(path.join(dir, ".logs", "2026-11.jsonl"), 'not json\n{"id":"x","ts":"2026-11-01T00:00:00.000Z","user":"u","action":"save","source":"ui"}\n');
    const log = new ActivityLog(path.join(dir, ".logs"), 12);
    expect((await log.query({})).entries).toHaveLength(1);
  });

  it("query on missing dir returns empty", async () => {
    const log = new ActivityLog(path.join(dir, ".nologs"), 12);
    expect(await log.query({})).toEqual({ entries: [], nextCursor: null });
  });

  it("prune keeps retention", async () => {
    mkdirSync(path.join(dir, ".logs"));
    for (const m of ["2025-10", "2025-11", "2026-11"]) writeFileSync(path.join(dir, ".logs", `${m}.jsonl`), "");
    writeFileSync(path.join(dir, ".logs", "README.txt"), "");
    const log = new ActivityLog(path.join(dir, ".logs"), 12, () => new Date("2026-11-15T00:00:00Z"));
    expect(await log.prune()).toEqual(["2025-10.jsonl"]);
    expect(readdirSync(path.join(dir, ".logs")).sort()).toEqual(["2025-11.jsonl", "2026-11.jsonl", "README.txt"]);
  });
});

describe("run logging", () => {
  it("POST /api/query logs entry without rows or credentials", async () => {
    const cluster = { id: "a", name: "A", hostname: "a", username: "axl", password: "pw-secret", version: "14.0" };
    const runner = new ClusterRunner([cluster], 1000, () => ({ executeSqlQuery: async () => ({ row: [{ n: "1" }, { n: "2" }] }) }));
    const log = new ActivityLog(path.join(dir, ".logs"), 12);
    const app = await buildApp({ config: testConfig({ clusters: [cluster], defaultClusterId: "a" }), runner, log });
    await app.inject({
      method: "POST",
      url: "/api/query",
      headers: { "remote-user": "jw" },
      payload: { sql: "select n from t", path: "Saved/q" },
    });
    const [entry] = (await log.query({})).entries;
    expect(entry).toMatchObject({ user: "jw", action: "run", source: "ui", sql: "select n from t", path: "Saved/q" });
    expect(entry.clusters).toEqual([{ id: "a", status: "ok", rowCount: 2, durationMs: expect.any(Number) }]);
    expect(JSON.stringify(entry)).not.toContain("rows");
    expect(JSON.stringify(entry)).not.toContain("pw-secret");
    expect(existsSync(path.join(dir, ".logs"))).toBe(true);
  });

  it("GET /api/log returns entries", async () => {
    const log = new ActivityLog(path.join(dir, ".logs"), 12);
    await log.append({ user: "jw", action: "save", source: "ui", path: "a" });
    const app = await buildApp({ config: testConfig(), log });
    const res = await app.inject({ method: "GET", url: "/api/log?user=jw" });
    expect(res.json().entries).toHaveLength(1);
    expect(res.json().nextCursor).toBeNull();
  });
});
