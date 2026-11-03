import type { AppConfig } from "../../server/config.js";

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    version: "1.0.0",
    dataDir: "/tmp/does-not-exist",
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
