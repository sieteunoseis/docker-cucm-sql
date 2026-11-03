import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../server/app.js";
import { testConfig } from "./helpers.js";

describe("app scaffold", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const webDist = mkdtempSync(path.join(tmpdir(), "web-"));
    writeFileSync(path.join(webDist, "index.html"), "<html>spa</html>");
    app = await buildApp({ config: testConfig(), webDist });
  });

  afterAll(() => app.close());

  it("health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("info returns version and cluster count", async () => {
    const res = await app.inject({ method: "GET", url: "/api/info" });
    expect(res.json().version).toBe("1.0.0");
    expect(res.json().clusterCount).toBe(0);
    expect(res.json().maxBatches).toBe(200);
  });

  it("unknown /api path is JSON 404", async () => {
    const res = await app.inject({ method: "GET", url: "/api/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toContain("application/json");
  });

  it("SPA fallback serves index.html for /q/Some/Path", async () => {
    const res = await app.inject({ method: "GET", url: "/q/Some/Path" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("spa");
  });
});
