import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { buildApp } from "./app.js";
import type { AppConfig } from "./config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// Works from both server/ (tsx) and dist/server/ (compiled)
const root = here.includes(`${path.sep}dist${path.sep}`) ? path.resolve(here, "..", "..") : path.resolve(here, "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

const config: AppConfig = {
  version: pkg.version,
  dataDir: process.env.DATA_DIR || "/app/data",
  port: Number(process.env.PORT) || 3000,
  queryTimeoutMs: 60000,
  maxBatches: 200,
  logRetentionMonths: 12,
  apiKey: null,
  clusters: [],
  defaultClusterId: "",
};

const app = await buildApp({ config, webDist: path.join(root, "web", "dist") });
await app.listen({ host: "0.0.0.0", port: config.port });
console.log(`CUCM SQL Editor ${config.version} listening on :${config.port}`);
