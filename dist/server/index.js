import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { buildApp } from "./app.js";
import { loadConfig, ConfigError } from "./config.js";
import { startupTasks } from "./startup.js";
const here = path.dirname(fileURLToPath(import.meta.url));
// Works from both server/ (tsx) and dist/server/ (compiled)
const root = here.includes(`${path.sep}dist${path.sep}`) ? path.resolve(here, "..", "..") : path.resolve(here, "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
let config;
try {
    config = loadConfig(process.env, pkg.version);
}
catch (err) {
    if (err instanceof ConfigError) {
        console.error(`Configuration error: ${err.message}`);
        process.exit(1);
    }
    throw err;
}
for (const line of await startupTasks(config))
    console.log(line);
const app = await buildApp({ config, webDist: path.join(root, "web", "dist") });
await app.listen({ host: "0.0.0.0", port: config.port });
console.log(`CUCM SQL Editor ${config.version} listening on :${config.port}`);
//# sourceMappingURL=index.js.map