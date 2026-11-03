import { describe, it, expect } from "vitest";
import { ClusterRunner, type AxlClient } from "../../server/axl.js";
import { buildApp } from "../../server/app.js";
import type { ClusterConfig } from "../../server/config.js";
import { testConfig } from "./helpers.js";

const cluster = (id: string): ClusterConfig => ({
  id,
  name: id.toUpperCase(),
  hostname: `${id}.example.com`,
  username: "axl",
  password: `pw-${id}-secret`,
  version: "14.0",
});

const FAULT =
  "Query request too large. Total rows matched: 2816 rows. Suggested row fetch: less than 844 rows";

function runnerWith(impl: Record<string, (sql: string) => Promise<unknown>>, timeoutMs = 1000) {
  const clusters = Object.keys(impl).map(cluster);
  const factory = (c: ClusterConfig): AxlClient => ({ executeSqlQuery: impl[c.id] as AxlClient["executeSqlQuery"] });
  return new ClusterRunner(clusters, timeoutMs, factory);
}

describe("ClusterRunner.run", () => {
  it("normalizes single-row object", async () => {
    const r = runnerWith({ a: async () => ({ row: { name: "a" } }) });
    const [res] = await r.run("select", ["a"]);
    expect(res).toMatchObject({ clusterId: "a", status: "ok", rows: [{ name: "a" }], columns: ["name"], rowCount: 1 });
  });

  it("accepts row nested under return", async () => {
    const r = runnerWith({ a: async () => ({ return: { row: [{ x: "1" }] } }) });
    expect((await r.run("s", ["a"]))[0].rows).toEqual([{ x: "1" }]);
  });

  it.each([{}, { row: "" }, null, undefined, { return: "" }])("empty result %j is ok with 0 rows", async (value) => {
    const r = runnerWith({ a: async () => value });
    const [res] = await r.run("s", ["a"]);
    expect(res.status).toBe("ok");
    expect(res.rowCount).toBe(0);
    expect(res.rows).toEqual([]);
  });

  it("undefined becomes empty string and columns are a union in first-seen order", async () => {
    const r = runnerWith({ a: async () => ({ row: [{ a: undefined, b: "1" }, { b: "2", c: 3 }] }) });
    const [res] = await r.run("s", ["a"]);
    expect(res.columns).toEqual(["a", "b", "c"]);
    expect(res.rows).toEqual([{ a: "", b: "1" }, { b: "2", c: "3" }]);
  });

  it("one cluster failing doesn't fail others", async () => {
    const r = runnerWith({
      a: async () => {
        throw new Error("A syntax error has occurred.");
      },
      b: async () => ({ row: [{ n: "1" }] }),
    });
    const res = await r.run("s", ["a", "b"]);
    expect(res.map((x) => x.status)).toEqual(["error", "ok"]);
    expect(res[0].error).toBe("A syntax error has occurred.");
  });

  it("timeout fails only the hanging cluster", async () => {
    const r = runnerWith({ a: () => new Promise(() => {}), b: async () => ({ row: [{ n: "1" }] }) }, 50);
    const res = await r.run("s", ["a", "b"]);
    expect(res[0].status).toBe("error");
    expect(res[0].error).toContain("Timed out");
    expect(res[1].status).toBe("ok");
  });

  it("throttle detected", async () => {
    const r = runnerWith({
      a: async () => {
        throw new Error(FAULT);
      },
    });
    const [res] = await r.run("s", ["a"]);
    expect(res.status).toBe("throttled");
    expect(res.throttle).toEqual({ totalRows: 2816, suggestedRows: 844 });
  });

  it("reads faultstring from a SOAP error root", async () => {
    const err = Object.assign(new Error("soap:Server"), { root: { Envelope: { Body: { Fault: { faultstring: FAULT } } } } });
    const r = runnerWith({
      a: async () => {
        throw err;
      },
    });
    expect((await r.run("s", ["a"]))[0].status).toBe("throttled");
  });
});

describe("ClusterRunner.test and schema", () => {
  it("test reports ok, latency and version", async () => {
    const r = runnerWith({
      a: async (sql) => (sql.includes("componentversion") ? { row: { version: "14.0.1.13900-155" } } : { row: { name: "pub" } }),
    });
    const t = await r.test("a");
    expect(t.ok).toBe(true);
    expect(t.version).toBe("14.0.1.13900-155");
    expect(typeof t.latencyMs).toBe("number");
  });

  it("test reports error", async () => {
    const r = runnerWith({
      a: async () => {
        throw new Error("Authentication failed");
      },
    });
    expect(await r.test("a")).toMatchObject({ ok: false, error: "Authentication failed" });
  });

  it("schema groups columns by table and is cached", async () => {
    let calls = 0;
    const r = runnerWith({
      a: async () => {
        calls++;
        return {
          row: [
            { tabname: "device", colname: "name", coltype: "13" },
            { tabname: "device", colname: "pkid", coltype: "256" },
            { tabname: "numplan", colname: "dnorpattern", coltype: "13" },
          ],
        };
      },
    });
    const s = await r.schema("a");
    expect(s.device).toEqual([
      { name: "name", type: "varchar" },
      { name: "pkid", type: "char" },
    ]);
    expect(s.numplan).toHaveLength(1);
    await r.schema("a");
    expect(calls).toBe(1);
  });
});

describe("query routes", () => {
  const clusters = [cluster("a"), cluster("b")];

  async function app(impl: Record<string, (sql: string) => Promise<unknown>>) {
    const runner = runnerWith(impl);
    return buildApp({ config: testConfig({ clusters, defaultClusterId: "a" }), runner });
  }

  it("runs on the default cluster when none given", async () => {
    const a = await app({ a: async () => ({ row: [{ n: "1" }] }), b: async () => ({}) });
    const res = await a.inject({ method: "POST", url: "/api/query", payload: { sql: "select 1" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().results.map((r: { clusterId: string }) => r.clusterId)).toEqual(["a"]);
  });

  it("rejects unknown cluster id", async () => {
    const a = await app({ a: async () => ({}), b: async () => ({}) });
    const res = await a.inject({ method: "POST", url: "/api/query", payload: { sql: "select 1", clusters: ["zzz"] } });
    expect(res.statusCode).toBe(400);
  });

  it("rejects empty sql", async () => {
    const a = await app({ a: async () => ({}), b: async () => ({}) });
    const res = await a.inject({ method: "POST", url: "/api/query", payload: { sql: "  " } });
    expect(res.statusCode).toBe(400);
  });

  it("response contains no password", async () => {
    const a = await app({
      a: async () => {
        throw new Error("boom");
      },
      b: async () => ({ row: [{ n: "1" }] }),
    });
    const res = await a.inject({ method: "POST", url: "/api/query", payload: { sql: "s", clusters: ["a", "b"] } });
    expect(res.body).not.toContain("pw-a-secret");
    expect(res.body).not.toContain("pw-b-secret");
  });

  it("cluster test and schema routes", async () => {
    const a = await app({ a: async () => ({ row: { name: "pub", tabname: "t", colname: "c", coltype: "0" } }), b: async () => ({}) });
    expect((await a.inject({ method: "GET", url: "/api/clusters/a/test" })).json().ok).toBe(true);
    expect((await a.inject({ method: "GET", url: "/api/clusters/zzz/test" })).statusCode).toBe(404);
    const schema = await a.inject({ method: "GET", url: "/api/schema?cluster=a" });
    expect(schema.json().tables.t).toEqual([{ name: "c", type: "char" }]);
  });
});

