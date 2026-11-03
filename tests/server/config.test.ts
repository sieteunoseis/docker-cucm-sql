import { describe, it, expect } from "vitest";
import { loadConfig } from "../../server/config.js";
import { buildApp } from "../../server/app.js";

const legacy = {
  NODE_ENV: "production",
  CUCM_HOSTNAME: "brbpub01.ohsu.edu",
  CUCM_USERNAME: "axluser",
  CUCM_PASSWORD: "s3cret-pw",
  CUCM_VERSION: "12.5",
};

const block = (n: number, name: string) => ({
  [`CUCM_${n}_NAME`]: name,
  [`CUCM_${n}_HOSTNAME`]: `${name.toLowerCase()}.example.com`,
  [`CUCM_${n}_USERNAME`]: "axl",
  [`CUCM_${n}_PASSWORD`]: "pw",
  [`CUCM_${n}_VERSION`]: "15.0",
});

describe("loadConfig", () => {
  it("legacy env yields one default cluster named after hostname", () => {
    const c = loadConfig(legacy, "1.0.0");
    expect(c.clusters).toHaveLength(1);
    expect(c.clusters[0].name).toBe("brbpub01.ohsu.edu");
    expect(c.clusters[0].id).toBe("brbpub01-ohsu-edu");
    expect(c.defaultClusterId).toBe("brbpub01-ohsu-edu");
  });

  it("CUCM_NAME sets display name", () => {
    const c = loadConfig({ ...legacy, CUCM_NAME: "BRB" }, "1.0.0");
    expect(c.clusters[0].name).toBe("BRB");
    expect(c.clusters[0].id).toBe("brb");
  });

  it("numbered clusters are read until first gap", () => {
    const c = loadConfig({ ...legacy, ...block(2, "Lab"), ...block(4, "Skipped") }, "1.0.0");
    expect(c.clusters.map((x) => x.id)).toEqual(["brbpub01-ohsu-edu", "lab"]);
  });

  it("duplicate names get numeric suffix ids", () => {
    const c = loadConfig({ ...legacy, CUCM_NAME: "Lab", ...block(2, "Lab") }, "1.0.0");
    expect(c.clusters.map((x) => x.id)).toEqual(["lab", "lab-2"]);
  });

  it("partial block throws naming missing vars", () => {
    const env = { ...legacy, ...block(2, "Lab") };
    delete (env as Record<string, string>).CUCM_2_PASSWORD;
    expect(() => loadConfig(env, "1.0.0")).toThrow(/CUCM_2_PASSWORD/);
  });

  it("missing legacy vars throws", () => {
    expect(() => loadConfig({ CUCM_HOSTNAME: "x" }, "1.0.0")).toThrow(/CUCM_USERNAME/);
  });

  it("bad version throws", () => {
    expect(() => loadConfig({ ...legacy, CUCM_VERSION: "fourteen" }, "1.0.0")).toThrow(/##\.#/);
  });

  it("three-part version is accepted and normalized to major.minor", () => {
    expect(loadConfig({ ...legacy, CUCM_VERSION: "12.5.1" }, "1.0.0").clusters[0].version).toBe("12.5");
  });

  it("defaults", () => {
    const c = loadConfig(legacy, "1.0.0");
    expect(c.queryTimeoutMs).toBe(60000);
    expect(c.maxBatches).toBe(200);
    expect(c.logRetentionMonths).toBe(12);
    expect(c.apiKey).toBeNull();
    expect(c.dataDir).toBe("/app/data");
    expect(c.port).toBe(3000);
  });

  it("overrides from env", () => {
    const c = loadConfig(
      { ...legacy, QUERY_TIMEOUT: "5", MAX_BATCHES: "10", LOG_RETENTION_MONTHS: "3", API_KEY: "k", DATA_DIR: "/d", PORT: "8080" },
      "1.0.0",
    );
    expect(c.queryTimeoutMs).toBe(5000);
    expect(c.maxBatches).toBe(10);
    expect(c.logRetentionMonths).toBe(3);
    expect(c.apiKey).toBe("k");
    expect(c.dataDir).toBe("/d");
    expect(c.port).toBe(8080);
  });
});

describe("GET /api/clusters", () => {
  it("never includes username or password", async () => {
    const app = await buildApp({ config: loadConfig({ ...legacy, ...block(2, "Lab") }, "1.0.0") });
    const res = await app.inject({ method: "GET", url: "/api/clusters" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
    expect(res.json()[0]).toEqual({ id: "brbpub01-ohsu-edu", name: "brbpub01.ohsu.edu", hostname: "brbpub01.ohsu.edu", version: "12.5" });
    expect(res.body).not.toContain("username");
    expect(res.body).not.toContain("s3cret-pw");
    await app.close();
  });
});
