export class ConfigError extends Error {
}
const FIELDS = ["HOSTNAME", "USERNAME", "PASSWORD", "VERSION"];
function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "cluster";
}
function readCluster(env, prefix) {
    const missing = FIELDS.map((f) => `${prefix}${f}`).filter((k) => !env[k]);
    if (missing.length) {
        throw new ConfigError(`Missing environment variable(s): ${missing.join(", ")}`);
    }
    // CUCM_VERSION must be in the format of ##.#; extra parts (12.5.1) are accepted and dropped
    const match = /^(\d+\.\d+)(\.\d+)*$/.exec(env[`${prefix}VERSION`].trim());
    const version = match?.[1];
    if (!version) {
        throw new ConfigError(`${prefix}VERSION must be in the format of ##.# (got "${env[`${prefix}VERSION`]}")`);
    }
    const hostname = env[`${prefix}HOSTNAME`];
    return {
        name: env[`${prefix}NAME`] || hostname,
        hostname,
        username: env[`${prefix}USERNAME`],
        password: env[`${prefix}PASSWORD`],
        version,
    };
}
function intEnv(env, key, fallback) {
    const raw = env[key];
    if (raw === undefined || raw === "")
        return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0)
        throw new ConfigError(`${key} must be a positive number (got "${raw}")`);
    return n;
}
export function loadConfig(env, version) {
    const raw = [readCluster(env, "CUCM_")];
    for (let n = 2; env[`CUCM_${n}_HOSTNAME`]; n++) {
        raw.push(readCluster(env, `CUCM_${n}_`));
    }
    const used = new Map();
    const clusters = raw.map((c) => {
        const base = slugify(c.name);
        const count = (used.get(base) ?? 0) + 1;
        used.set(base, count);
        return { ...c, id: count === 1 ? base : `${base}-${count}` };
    });
    return {
        version,
        dataDir: env.DATA_DIR || "/app/data",
        port: intEnv(env, "PORT", 3000),
        queryTimeoutMs: intEnv(env, "QUERY_TIMEOUT", 60) * 1000,
        maxBatches: intEnv(env, "MAX_BATCHES", 200),
        logRetentionMonths: intEnv(env, "LOG_RETENTION_MONTHS", 12),
        apiKey: env.API_KEY || null,
        clusters,
        defaultClusterId: clusters[0].id,
    };
}
export function publicCluster(c) {
    return { id: c.id, name: c.name, hostname: c.hostname, version: c.version };
}
//# sourceMappingURL=config.js.map