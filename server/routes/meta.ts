import type { FastifyInstance } from "fastify";
import { publicCluster, type AppConfig } from "../config.js";

export async function metaRoutes(app: FastifyInstance, opts: { config: AppConfig }) {
  const { config } = opts;

  app.get("/api/clusters", async () => config.clusters.map(publicCluster));
}
