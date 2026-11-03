import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildApp } from "../../server/app.js";
import { ActivityLog } from "../../server/activityLog.js";
import { ClusterRunner } from "../../server/axl.js";
import { startupTasks } from "../../server/startup.js";
import { testConfig } from "./helpers.js";

const cluster = { id: "a", name: "A", hostname: "a", username: "u", password: "p", version: "14.0" };

describe("activity log failures are not fatal", () => {
  it("query results still return when the log can't be written", async () => {
    const log = new ActivityLog("/x", 12);
    vi.spyOn(log, "append").mockRejectedValue(Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" }));
    const runner = new ClusterRunner([cluster], 1000, () => ({ executeSqlQuery: async () => ({ row: [{ n: "1" }] }) }));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = await buildApp({ config: testConfig({ clusters: [cluster], defaultClusterId: "a" }), runner, log });
    const res = await app.inject({ method: "POST", url: "/api/query", payload: { sql: "select 1" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().results[0].rowCount).toBe(1);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("startupTasks", () => {
  it("prunes old log files", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "start-"));
    mkdirSync(path.join(dir, ".logs"));
    writeFileSync(path.join(dir, ".logs", "2000-01.jsonl"), "");
    const messages = await startupTasks(testConfig({ dataDir: dir }));
    expect(existsSync(path.join(dir, ".logs", "2000-01.jsonl"))).toBe(false);
    expect(messages.some((m) => m.includes("2000-01.jsonl"))).toBe(true);
  });

  it("explains how to fix a data dir the app can't write", async () => {
    const messages = await startupTasks(testConfig({ dataDir: "/proc/definitely-not-writable" }));
    expect(messages.join("\n")).toMatch(/not writable/);
    expect(messages.join("\n")).toMatch(/chown -R 1000:1000/);
  });
});
