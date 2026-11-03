# Changelog

## [1.0.0] - 2026-11-03

A ground-up rewrite. Existing `.env` files and `data/*.sql` files work unchanged.

### Added
- Run one query on several CUCM clusters at once, configured with the `CUCM_<N>_*` environment variables
- Folders for saved queries, plus rename, move, duplicate and delete in the UI
- Optional `-- description:` line shown in the sidebar
- `:name` / `:name=default` query variables, which can also be filled in from the URL
- Links to saved queries (`/q/<path>`) that can pick clusters, set variables and run the query (`?run=1`)
- Batch fetching of results over UCM's 8 MB limit, using `SKIP/FIRST` (capped by `MAX_BATCHES`)
- Table and column autocomplete loaded from the cluster's schema
- Connection test with a status dot for each cluster
- Activity log page showing who ran or changed what (`Remote-User` from Authelia), stored in `data/.logs`
- `GET /api/run/<path>` for running a saved query from scripts, with JSON or CSV output and optional `API_KEY` auth
- `GET /api/export.zip` for downloading every saved query
- `GET /api/info` and `GET /api/health`, plus a container `HEALTHCHECK`
- Command palette (`Ctrl/Cmd+K`) and a dark theme

### Changed
- Rebuilt on Fastify and TypeScript, with a React and Vite UI using the cisco-cdr-ui look
- Monaco replaces CodeMirror
- Images are published to GHCR only: `:main` for every push to `main`, and `:latest` / `:X.Y.Z` for release tags
- The container runs as the non-root `node` user on `node:22-slim`

### Removed
- Handsontable, jQuery, Select2 and Handlebars
- Docker Hub publishing (`sieteunoseis/cucm-sql-editor` will not get new versions)
