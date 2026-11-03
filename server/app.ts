import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { existsSync } from "node:fs";
import type { AppConfig } from "./config.js";
import { metaRoutes } from "./routes/meta.js";
import { queryRoutes } from "./routes/query.js";
import { ClusterRunner } from "./axl.js";

export interface AppDeps {
  config: AppConfig;
  runner?: ClusterRunner;
  webDist?: string;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { config } = deps;
  const runner = deps.runner ?? new ClusterRunner(config.clusters, config.queryTimeoutMs);
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
  }));

  await app.register(metaRoutes, { config, runner });
  await app.register(queryRoutes, { config, runner });

  const hasWeb = deps.webDist && existsSync(deps.webDist);
  if (hasWeb) {
    await app.register(fastifyStatic, { root: deps.webDist!, wildcard: false });
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api") || req.method !== "GET" || !hasWeb) {
      return reply.code(404).send({ error: "not_found", message: `Route ${req.method} ${req.url} not found` });
    }
    return reply.type("text/html").sendFile("index.html");
  });

  return app;
}
