import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { existsSync } from "node:fs";
import type { AppConfig } from "./config.js";
import { metaRoutes } from "./routes/meta.js";
import { queryRoutes } from "./routes/query.js";
import { ClusterRunner } from "./axl.js";
import { ActivityLog } from "./activityLog.js";
import { identityFrom } from "./identity.js";
import { logRoutes } from "./routes/log.js";
import { queriesRoutes } from "./routes/queries.js";
import { legacyRoutes } from "./routes/legacy.js";
import { QueryStore } from "./store.js";
import { runRoutes } from "./routes/run.js";
import path from "node:path";

export interface AppDeps {
  config: AppConfig;
  runner?: ClusterRunner;
  log?: ActivityLog;
  store?: QueryStore;
  webDist?: string;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const runner = deps.runner ?? new ClusterRunner(config.clusters, config.queryTimeoutMs);
  const store = deps.store ?? new QueryStore(config.dataDir);
  const log = deps.log ?? new ActivityLog(path.join(config.dataDir, ".logs"), config.logRetentionMonths);
  const app = Fastify({ logger: false });

  await app.register(fastifySwagger, {
    openapi: {
      info: { title: "CUCM SQL Editor API", version: config.version },
    },
  });
  await app.register(fastifySwaggerUi, { routePrefix: "/api/docs" });

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/info", async () => ({
    version: config.version,
    imageTag: process.env.IMAGE_TAG ?? null,
    clusterCount: config.clusters.length,
    maxBatches: config.maxBatches,
  }));

  await app.register(metaRoutes, { config, runner });
  await app.register(queryRoutes, {
    config,
    runner,
    onRun: async ({ req, sql, path: queryPath, results }) => {
      await log.append({
        user: identityFrom(req.headers),
        action: "run",
        source: "ui",
        sql,
        ...(queryPath ? { path: queryPath } : {}),
        clusters: results.map((r) => ({
          id: r.clusterId,
          status: r.status,
          rowCount: r.rowCount,
          durationMs: r.durationMs,
          ...(r.error ? { error: r.error } : {}),
        })),
      });
    },
  });
  await app.register(logRoutes, { log });
  await app.register(queriesRoutes, { store, log });
  await app.register(legacyRoutes, { config, runner, store });
  await app.register(runRoutes, { config, runner, store, log });

  const hasWeb = deps.webDist && existsSync(deps.webDist);
  if (hasWeb) {
    await app.register(fastifyStatic, { root: deps.webDist!, wildcard: false });
  }

  app.setNotFoundHandler((req, reply) => {
    // missing build assets (e.g. /assets/x.js after a redeploy) must 404 rather than return the HTML shell
    const pathname = req.url.split("?")[0];
    const isAsset = !pathname.startsWith("/q/") && (pathname.startsWith("/assets/") || /\.[a-z0-9]+$/i.test(pathname));
    if (req.url.startsWith("/api") || req.method !== "GET" || !hasWeb || isAsset) {
      return reply.code(404).send({ error: "not_found", message: `Route ${req.method} ${req.url} not found` });
    }
    return reply.type("text/html").sendFile("index.html");
  });

  return app;
}
