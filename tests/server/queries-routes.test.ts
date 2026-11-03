import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../server/app.js";
import { ActivityLog } from "../../server/activityLog.js";
import { ClusterRunner } from "../../server/axl.js";
import { testConfig } from "./helpers.js";

let app: FastifyInstance;
let dir: string;
let log: ActivityLog;
let axlResult: unknown;

function put(rel: string, content = "select 1") {
  const p = path.join(dir, rel);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content);
}

beforeEach(async () => {
  const cluster = { id: "a", name: "A", hostname: "a", username: "u", password: "p", version: "14.0" };
  const config = testConfig({ clusters: [cluster], defaultClusterId: "a" });
  dir = config.dataDir;
  log = new ActivityLog(path.join(dir, ".logs"), 12);
  axlResult = { row: [{ name: "pub" }] };
  const runner = new ClusterRunner([cluster], 1000, () => ({ executeSqlQuery: async () => axlResult }));
  app = await buildApp({ config, log, runner });
});

const lastLog = async () => (await log.query({ limit: 1 })).entries[0];

describe("saved-query routes", () => {
  it("GET /api/queries returns tree", async () => {
    put("A/b.sql");
    put("c.sql");
    const res = await app.inject({ method: "GET", url: "/api/queries" });
    expect(res.json().tree.map((n: { path: string }) => n.path)).toEqual(["A", "c"]);
  });

  it("GET /api/queries/* returns contents", async () => {
    put("Phones/Phones_with_DN.sql", "select dn");
    const res = await app.inject({ method: "GET", url: "/api/queries/Phones/Phones_with_DN" });
    expect(res.json()).toEqual({ path: "Phones/Phones_with_DN", sql: "select dn" });
  });

  it("GET missing query is 404 JSON", async () => {
    const res = await app.inject({ method: "GET", url: "/api/queries/Old/Gone" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("not_found");
  });

  it("GET with encoded spaces sanitizes like save does", async () => {
    put("My_Folder/q.sql", "x");
    const res = await app.inject({ method: "GET", url: "/api/queries/My%20Folder/q" });
    expect(res.json().sql).toBe("x");
  });

  it("PUT saves formatted sql and logs", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/queries/New/q",
      headers: { "remote-user": "jw" },
      payload: { sql: "select name from device where name = :n=SEP1" },
    });
    expect(res.json()).toEqual({ path: "New/q" });
    const saved = readFileSync(path.join(dir, "New/q.sql"), "utf8");
    expect(saved).toContain("SELECT");
    expect(saved).toContain(":n=SEP1");
    expect(await lastLog()).toMatchObject({ user: "jw", action: "save", path: "New/q" });
  });

  it("PUT with traversal is 400", async () => {
    const res = await app.inject({ method: "PUT", url: "/api/queries/..%2F..%2Fetc", payload: { sql: "x" } });
    expect(res.statusCode).toBe(400);
  });

  it("move renames and logs; onto existing is 409", async () => {
    put("a.sql");
    put("b.sql");
    const conflict = await app.inject({ method: "POST", url: "/api/queries/move", payload: { from: "a", to: "b" } });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error).toBe("exists");
    const ok = await app.inject({ method: "POST", url: "/api/queries/move", payload: { from: "a", to: "F/a" } });
    expect(ok.json()).toEqual({ path: "F/a" });
    expect(await lastLog()).toMatchObject({ action: "move", path: "a", to: "F/a" });
  });

  it("duplicate copies and logs", async () => {
    put("a.sql", "A");
    const res = await app.inject({ method: "POST", url: "/api/queries/duplicate", payload: { from: "a", to: "a_copy" } });
    expect(res.json()).toEqual({ path: "a_copy" });
    expect(readFileSync(path.join(dir, "a_copy.sql"), "utf8")).toBe("A");
    expect(await lastLog()).toMatchObject({ action: "duplicate", path: "a", to: "a_copy" });
  });

  it("DELETE removes folder and logs deleted sql", async () => {
    put("F/x.sql", "X");
    const res = await app.inject({ method: "DELETE", url: "/api/queries/F" });
    expect(res.json()).toEqual({ deleted: ["F/x"] });
    expect(existsSync(path.join(dir, "F"))).toBe(false);
    expect(await lastLog()).toMatchObject({ action: "delete", path: "F", deletedSql: { "F/x": "X" } });
  });

  it("count and folder create", async () => {
    put("F/x.sql");
    put("F/y.sql");
    expect((await app.inject({ method: "GET", url: "/api/queries-count/F" })).json()).toEqual({ count: 2 });
    const res = await app.inject({ method: "POST", url: "/api/folders", payload: { path: "Empty" } });
    expect(res.json()).toEqual({ path: "Empty" });
    expect(await lastLog()).toMatchObject({ action: "folder_create", path: "Empty" });
  });

  it("export.zip contains sql files with folders and excludes hidden", async () => {
    put("A/b.sql", "B");
    put("c.sql", "C");
    put(".logs/2026-11.jsonl", "{}");
    put("notes.txt", "n");
    const res = await app.inject({ method: "GET", url: "/api/export.zip" });
    expect(res.headers["content-type"]).toBe("application/zip");
    const zip = new AdmZip(res.rawPayload);
    expect(zip.getEntries().map((e) => e.entryName).sort()).toEqual(["A/b.sql", "c.sql"]);
    expect(zip.readAsText("A/b.sql")).toBe("B");
  });
});

describe("legacy 0.x routes", () => {
  it("getfiles lists top-level sql filenames only, sorted", async () => {
    put("b.sql");
    put("a.sql");
    put("F/nested.sql");
    const res = await app.inject({ method: "GET", url: "/api/getfiles" });
    expect(res.json()).toEqual(["a.sql", "b.sql"]);
  });

  it("getquery returns fileName and data", async () => {
    put("Show_Nodes.sql", "select name from processnode");
    const res = await app.inject({ method: "GET", url: "/api/getquery/Show_Nodes.sql" });
    expect(res.json()).toEqual({ fileName: "Show_Nodes.sql", data: "select name from processnode" });
  });

  it("getquery missing is 500 No file found", async () => {
    const res = await app.inject({ method: "GET", url: "/api/getquery/nope.sql" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ message: "No file found" });
  });

  it("savequery sanitizes, formats and writes top-level", async () => {
    const res = await app.inject({ method: "POST", url: "/api/savequery", payload: { fileName: "My Query", query: "select 1" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("Successfully saved file");
    expect(readFileSync(path.join(dir, "My_Query.sql"), "utf8")).toContain("SELECT");
  });

  it("savequery flattens slashes like 0.x", async () => {
    await app.inject({ method: "POST", url: "/api/savequery", payload: { fileName: "a/b", query: "select 1" } });
    expect(existsSync(path.join(dir, "a_b.sql"))).toBe(true);
  });

  it("getdata returns AXL shape from default cluster", async () => {
    const res = await app.inject({ method: "POST", url: "/api/getdata", payload: { query: "select name from processnode" } });
    expect(res.json()).toEqual({ row: [{ name: "pub" }] });
  });

  it("getdata empty is 204", async () => {
    axlResult = {};
    const res = await app.inject({ method: "POST", url: "/api/getdata", payload: { query: "select 1" } });
    expect(res.statusCode).toBe(204);
  });
});
