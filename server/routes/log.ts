import type { FastifyInstance } from "fastify";
import type { ActivityLog, LogFilter } from "../activityLog.js";

export async function logRoutes(app: FastifyInstance, opts: { log: ActivityLog }) {
  app.get<{ Querystring: Record<string, string> }>("/api/log", async (req) => {
    const { user, action, q, from, to, cursor, limit } = req.query;
    const filter: LogFilter = { user, action: action as LogFilter["action"], q, from, to, cursor };
    if (limit) filter.limit = Number(limit);
    return opts.log.query(filter);
  });
}
