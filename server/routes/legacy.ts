// 0.x API, kept with the same request/response shapes so existing callers keep working.
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import type { ClusterRunner } from "../axl.js";
import type { QueryStore } from "../store.js";
import { formatForSave } from "../../shared/formatSql.js";

export async function legacyRoutes(app: FastifyInstance, opts: { config: AppConfig; runner: ClusterRunner; store: QueryStore }) {
  const { config, runner, store } = opts;

  app.post<{ Body: { query?: string } }>("/api/getdata", async (req, reply) => {
    const result = await runner.runOne(req.body?.query ?? "", config.defaultClusterId);
    if (result.status !== "ok") return reply.code(500).send({ message: result.error });
    if (!result.rows.length) return reply.code(204).send();
    return { row: result.rows };
  });

  app.get("/api/getfiles", async () =>
    (await store.tree()).filter((n) => n.type === "query").map((n) => `${n.name}.sql`).sort((a, b) => a.localeCompare(b)),
  );

  app.get<{ Params: { name: string } }>("/api/getquery/:name", async (req, reply) => {
    try {
      return { fileName: req.params.name, data: await store.read(store.sanitizePath(req.params.name)) };
    } catch {
      return reply.code(500).send({ message: "No file found" });
    }
  });

  app.post<{ Body: { fileName?: string; query?: string } }>("/api/savequery", async (req, reply) => {
    try {
      // 0.x replaced "/" too, so legacy saves always land at the top level
      const name = String(req.body?.fileName ?? "").replace(/[/\\?%*:|"<>\s]/g, "_");
      await store.write(store.sanitizePath(name), formatForSave(String(req.body?.query ?? "")));
      return reply.type("text/html").send("Successfully saved file");
    } catch {
      return reply.code(500).send("Error");
    }
  });
}
