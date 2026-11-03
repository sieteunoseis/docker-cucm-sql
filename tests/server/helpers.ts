import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AppConfig } from "../../server/config.js";

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    version: "1.0.0",
    dataDir: mkdtempSync(path.join(tmpdir(), "cucm-sql-test-")),
    port: 3000,
    queryTimeoutMs: 60000,
    maxBatches: 200,
    logRetentionMonths: 12,
    apiKey: null,
    clusters: [],
    defaultClusterId: "",
    ...overrides,
  };
}
