export async function logRoutes(app, opts) {
    app.get("/api/log", async (req) => {
        const { user, action, q, from, to, cursor, limit } = req.query;
        const filter = { user, action: action, q, from, to, cursor };
        if (limit)
            filter.limit = Number(limit);
        return opts.log.query(filter);
    });
}
//# sourceMappingURL=log.js.map