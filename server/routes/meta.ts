import type { FastifyInstance } from "fastify";
import { publicCluster, type AppConfig } from "../config.js";
import type { ClusterRunner } from "../axl.js";

export async function metaRoutes(app: FastifyInstance, opts: { config: AppConfig; runner: ClusterRunner }) {
  const { config, runner } = opts;

  app.get("/api/clusters", async () => config.clusters.map(publicCluster));

  app.get<{ Params: { id: string } }>("/api/clusters/:id/test", async (req, reply) => {
    if (!runner.has(req.params.id)) return reply.code(404).send({ error: "not_found", message: "Unknown cluster" });
    return runner.test(req.params.id);
  });

  app.get<{ Querystring: { cluster?: string } }>("/api/schema", async (req, reply) => {
    const id = req.query.cluster || config.defaultClusterId;
    if (!runner.has(id)) return reply.code(404).send({ error: "not_found", message: "Unknown cluster" });
    try {
      return { tables: await runner.schema(id) };
    } catch (err) {
      return reply.code(502).send({ error: "schema_failed", message: (err as Error).message });
    }
  });
}
