# CUCM SQL Editor — Modernization Design

Date: 2026-11-03
Repo: `sieteunoseis/docker-cucm-sql` (git identity: sieteunoseis)
Prod deployment: `~/development/biccapps-docker-compose/cucm-sql`

## Intent

The current app works and the team uses it daily (a query was saved today). Nothing is broken;
it needs a refresh: a modern UI matching `~/development/cisco-cdr-ui`, multi-cluster querying,
better saved-query management, and a handful of features borrowed from
[axlrows](https://github.com/Karmatek-Consulting-LLC/axlrows) and cisco-cdr-ui.

Success = existing users pull the new image, keep their `.env` and `./data` volume unchanged, and
everything they had still works — plus the new features.

## Hard constraints

1. **Saved queries stay plain `.sql` files** in the mounted `/app/data` volume. No database, no
   sidecar metadata required. Existing flat files (e.g. `data/Show_Nodes.sql`) must load untouched.
   Files remain hand-editable on the host.
2. **Configuration is env-only.** No DB, no UI-managed servers/credentials.
3. **Existing `.env` keeps working unchanged** (`NODE_ENV`, `CUCM_HOSTNAME`, `CUCM_USERNAME`,
   `CUCM_PASSWORD`, `CUCM_VERSION`) as the single/default cluster.
4. **Internal-only tool.** No app-level authentication — Authelia (forward-auth at nginx) already
   gates access in prod. The app must not break behind it (relative asset paths, no
   cross-origin calls, SPA deep links like `/q/...` served `index.html`). If Authelia's
   `Remote-User` header feeds the Activity log (below); app must work fine without it. Runs behind the existing nginx (`nginx_default`
   network) on port 3000, container runs as `user: "1000:1000"` — files it writes must be owned
   by that user (no root in the image at runtime).
5. **AXL passwords never reach the browser.**

## Goals

- UI rebuilt on cisco-cdr-ui's stack and look: React 19 + Vite + TypeScript + Tailwind 4 +
  shadcn/ui + Monaco editor + lucide icons + Geist font, light/dark theme.
- Multi-cluster: select one or more clusters per run; queries execute concurrently; each result
  row is tagged with its source cluster; one cluster failing does not fail the others
  (per-cluster status chip: row count, duration, or Informix error).
- Saved-query management: folders, rename, move, duplicate, delete.
- Deep links: every saved query has a URL; variables and cluster selection can be supplied via
  query string.
- Results grid: sort, per-column filter, global search, column show/hide, CSV export.
  Handsontable is dropped.
- Large result handling (UCM 8 MB `executeSQLQuery` cap) via `SKIP/FIRST` batching, per axlrows.
- Schema-aware autocomplete for table and column names in Monaco.
- Keyboard: `Ctrl/Cmd+Enter` run, `Ctrl/Cmd+S` save, `Ctrl/Cmd+K` command palette (jump to
  saved query / action).
- Format button (sql-formatter), as today.

## Non-goals

- Write/update SQL (AXL `executeSQLUpdate`). Stays SELECT-only, as today.
- Authentication, users, per-user favorites.
- UI to add/edit clusters or store credentials.
- Desktop packaging (axlrows is Tauri; we stay a web container).
- Any database (SQLite included).

## Anti-goals (failure even if it works)

- Existing saved queries don't show up, or get rewritten/moved on startup.
- Existing `.env` requires edits to keep working.
- A runaway query fires thousands of AXL requests at a production publisher.
- Credentials visible in the browser, API responses, or logs.

## Architecture

Single container, one Node process:

- **Backend:** Node 22 LTS + TypeScript, Fastify (the user's companion services already use it).
  Serves the built SPA from `/` and the JSON API under `/api`. Uses the `cisco-axl` npm library
  (latest major) for `executeSQLQuery`. Swagger kept at `/api/docs`.
- **Frontend:** Vite SPA, copied/adapted from cisco-cdr-ui components (`SqlEditor`,
  `SqlResults`, `SavedQueries`, `SqlVariables`, layout, theme hook, `ui/*`). Built at image build
  time; no runtime CDN.
- **Image:** multi-stage Dockerfile, `node:22-slim` (pinned, not `node:latest`), production deps
  only, runs `node dist/server.js` (no nodemon in prod).

### Cluster configuration (env)

```
# Default / legacy — still works alone
CUCM_HOSTNAME=brbpub01.ohsu.edu
CUCM_USERNAME=axluser
CUCM_PASSWORD=...
CUCM_VERSION=12.5
CUCM_NAME=BRB                 # optional display name; defaults to CUCM_HOSTNAME

# Additional clusters, N = 2, 3, ...  (scan until the first missing CUCM_<N>_HOSTNAME)
CUCM_2_NAME=Lab
CUCM_2_HOSTNAME=labpub01.example.com
CUCM_2_USERNAME=axluser
CUCM_2_PASSWORD=...
CUCM_2_VERSION=15.0
```

- Cluster id = slug of the name (used in URLs and row tags).
- `GET /api/clusters` returns `[{id, name, hostname, version}]` — never username/password.
- Startup validation: fail fast with a clear message if a cluster block is partial.
- `CUCM_VERSION` validation keeps the existing `##.#` rule.

### Saved queries on disk

- Root: `/app/data`. Folders are subdirectories (any depth). A query = `<path>/<name>.sql`.
- Query identity = relative path without extension, e.g. `Phones/Phones_with_DN`.
- File names: same sanitization as today (`/\?%*:|"<>` and whitespace → `_`), applied per path
  segment. Path traversal (`..`, absolute paths, symlinks escaping root) rejected.
- Hidden entries (`.` prefix) are ignored by listings.
- User confirmed: no login, and anyone may delete/rename/move.
- **Delete is permanent** (user decision: nothing should grow on disk without users knowing).
  UI shows a confirm dialog naming the file (and, for a folder, how many queries it contains).
  The Activity log records the delete including the deleted SQL text, so it can be recovered
  from `/log` within retention if needed.
- Saving still runs sql-formatter (as today) with a fallback to raw text on format failure —
  BUT keep `:variable` tokens intact (verify sql-formatter doesn't mangle them; if it does,
  use its `paramTypes: { named: [':'] }` option).
- Optional leading comment header is allowed and preserved verbatim, e.g.
  `-- description: Phones with DN in a partition`. If present, the first `-- description:` line
  is shown in the sidebar. Not required; plain files remain fully supported.

### API

Existing routes kept for compatibility (same request/response shapes):

| Route | Notes |
|---|---|
| `POST /api/getdata` `{query}` | runs on the default cluster |
| `GET /api/getfiles` | returns flat list of top-level `*.sql` names, as today |
| `GET /api/getquery/:name` | top-level file, as today |
| `POST /api/savequery` `{fileName, query}` | top-level save, as today |

New routes (shape is builder's call, suggested):

| Route | Purpose |
|---|---|
| `GET /api/clusters` | list configured clusters (no secrets) |
| `POST /api/query` `{sql, clusters:[id...], batch?:bool}` | run on selected clusters concurrently; per-cluster `{status, rows, columns, durationMs, error?, throttle?}` |
| `GET /api/queries` | tree of folders + queries |
| `GET /api/queries/*path` | file contents |
| `PUT /api/queries/*path` `{sql}` | create/overwrite |
| `POST /api/queries/*path/move` `{to}` | rename or move (file or folder) |
| `POST /api/queries/*path/duplicate` `{to}` | copy |
| `DELETE /api/queries/*path` | permanent delete (file, or folder recursively) |
| `POST /api/folders` `{path}` | create folder |
| `GET /api/schema?cluster=id` | tables + columns for autocomplete (cached in memory per cluster) |
| `GET /api/health` | liveness |
| `GET /api/clusters/:id/test` | AXL connectivity check: `{ok, latencyMs, version?, error?}` (e.g. `select first 1 name from processnode`); UI shows a status dot per cluster |
| `GET /api/run/*path` | run a saved query by path (see below) |
| `GET /api/queries/export.zip` | zip of all saved `.sql` files with folder structure (excludes `.logs`) |
| `GET /api/info` | `{version, imageTag?, clusterCount}`; version shown in UI footer |

#### `GET /api/run/*path` (integration endpoint)

For Windmill / Grafana / Excel / curl to reuse saved queries without copying SQL.

- `GET /api/run/Phones/Phones_with_DN?cluster=brb,lab&dn=1234&format=json|csv`
- Query-string keys other than `cluster`/`format` fill `:variables` (same substitution rules as
  the UI). Missing required variable → 400 listing missing names.
- `cluster` defaults to the default cluster; multiple clusters adds a `cluster` column.
- `format=json` (default): `{columns, rows, clusters:[{id, status, rowCount, durationMs, error?}]}`.
  `format=csv`: CSV body, `Content-Disposition` with the query name.
- No auto-batching on throttle: returns 413 with the parsed total/suggested counts.
- Logged in the Activity log as `run` with `source: "api"` and the caller identity.
- **Auth:** Authelia will block non-browser callers, so prod needs an Authelia bypass rule for
  `^/api/run/` (deploy step in `biccapps-docker-compose`, not this repo). The app adds its own
  guard: env `API_KEY` (optional); when set, `/api/run` requests without a `Remote-User` header
  must send `Authorization: Bearer <API_KEY>` or get 401. Caller identity in the log =
  `Remote-User`, else `api-key`. Recommended to always set `API_KEY` in prod.

### Running queries

- Concurrent per cluster (`Promise.allSettled`). A per-request timeout (env `QUERY_TIMEOUT`,
  default 60 s).
- Results merged in the UI with a leading `cluster` column when >1 cluster is selected.
- Existing behavior to keep: `undefined` values become `""`; "no rows" is a normal, non-error
  state.

### Large result sets (8 MB cap)

Follow axlrows' approach:

- Parse the fault `Query request too large. Total rows matched: N rows. Suggested row fetch:
  less than M rows`.
- Show "Fetch all N in K batches" button for that cluster. Batch size = `floor(M / 5)`.
- Rewrite as `SELECT SKIP n FIRST m ...` (Informix). Halve the batch size if a batch still
  throttles. Cancellable; progress shown per batch.
- Do not paginate queries with a top-level `UNION`/`INTERSECT`/`MINUS` or an existing
  `SKIP`/`FIRST`/`LIMIT`; explain why instead.
- Never auto-batch without a click (no auto-fetch setting needed).
- Batching is driven by the browser (one `/api/query` call per batch with the rewritten SQL),
  so Cancel just stops the loop; no server-side cancel endpoint.
- Hard ceiling on batch count per run (env `MAX_BATCHES`, default 200).

### Variables

User asked for the same Variables feature cisco-cdr-ui has. Port
`cisco-cdr-ui/src/components/sql/SqlVariables.tsx` behavior exactly:

- Syntax: `:name` or `:name=default` (default ends at whitespace, `,` or `)`).
  `::type` casts and tokens inside quotes (`':x`) are ignored.
- Each distinct variable becomes an input in a "Variables" bar under the editor, pre-filled
  with its default; values persist while editing the query.
- Before run, each token is replaced with the value wrapped in single quotes, `'` doubled.
  Empty value with no default leaves `:name` in place (the run will then fail on UCM — the UI
  should instead block Run and highlight the empty field; builder's call).
- Variables are part of the saved `.sql` text, so a saved query carries its defaults.
- Deep-link: `?name=value` fills the matching variable (see URLs).
- **Formatter gotcha:** saving runs sql-formatter; it must not turn `:name=default` into
  `:name = default` or split `::`. Verify with tests; use `paramTypes: { named: [':'] }` or
  skip formatting of variable tokens if needed.
- **Informix gotcha:** always-quoting works for comparisons (Informix casts `'123'` to a number
  column) but not where a literal integer is required (e.g. `FIRST :n`). Acceptable for v1;
  document it in the help text.

### Activity log (user request)

A **Log** nav item (header nav, like cisco-cdr-ui's pages) showing who ran what.

- Source of "who": Authelia's `Remote-User` header (fallback `Remote-Name`/`Remote-Email`,
  else `anonymous`). Never trusted for anything but display.
- Logged events: `run` (SQL actually executed after variable substitution, clusters, per-cluster
  row count / duration / error, saved-query path if loaded from one), `save`, `rename/move`,
  `duplicate`, `delete`, `folder create`.
- Storage: **append-only JSON Lines files** in the data volume, `data/.logs/YYYY-MM.jsonl`
  (no DB; hidden folder so it never appears in the query tree). Retention env
  `LOG_RETENTION_MONTHS` (default 12); older files pruned on startup.
- Page `/log`: newest-first table (time, user, action, clusters, query name, rows, duration,
  status), filters for user / action / text search / date range, paginated server-side
  (`GET /api/log?user=&action=&q=&from=&to=&cursor=`). Clicking a run row opens its SQL in the
  editor (new tab) so it can be re-run.
- Credentials never logged. Very long SQL stored in full (it's the point), but the table
  truncates for display.

### URLs (deep links)

- `/` — empty editor.
- `/q/<path>` — open saved query, e.g. `/q/Phones/Phones_with_DN`.
- Query string: `?cluster=brb,lab` selects clusters; `?<var>=<value>` pre-fills variables;
  `?run=1` runs immediately on load.
- A "Copy link" button builds the URL from the current query, clusters, and variable values.
- Unsaved editor content isn't encoded in URLs (keep URLs short and readable).

### UI layout

- Mirror cisco-cdr-ui: header with app name, theme toggle; left sidebar with saved-query tree
  (folders collapsible, search box, context menu: rename, move, duplicate, delete, new folder,
  copy link); main area: cluster multi-select + Run/Format/Save/Clear toolbar, Monaco editor,
  variables panel, per-cluster status chips, results grid.
- Results grid: shadcn table, client-side sort/filter/search/column visibility; virtualized
  rows (e.g. `@tanstack/react-table` + `@tanstack/react-virtual`) so tens of thousands of rows
  stay responsive. CSV export of the filtered view.
- Drag-and-drop to move queries between folders is nice-to-have, not required.

## Release / deployment

- Bump to **1.0.0** (UI rewrite, new API, backwards-compatible config and data).
- Update README (env vars incl. multi-cluster, folders, URLs, screenshots) with the Support /
  Buy Me a Coffee section; add CHANGELOG.md.
- **Image registry: GHCR only** (user decision).
- **Tag strategy** (user decision): watchtower on the prod host auto-updates `:latest`, so
  - push to `main` → `ghcr.io/sieteunoseis/docker-cucm-sql:main` only (for testing);
  - push of a `v*` git tag → `:latest` and `:X.Y.Z` (this is what reaches prod).
  Release = bump `package.json` version, CHANGELOG entry, `git tag vX.Y.Z && git push origin vX.Y.Z`.
  The test container uses `:main`. Drop the manual Docker Hub `docker:build`/`docker:push` npm scripts and update README
  pull instructions to GHCR. The prod compose switches from
  `sieteunoseis/cucm-sql-editor:latest` (Docker Hub) to `ghcr.io/sieteunoseis/docker-cucm-sql`.
  The GHCR package must be public (or prod logs in via `gh auth token | docker login ghcr.io`).
  README notes the move for existing Docker Hub users; the old Docker Hub tag is left as-is.
- Prod cutover: test on a separate container/port against a copy of `./data`, then switch
  `biccapps-docker-compose/cucm-sql` to the new image. Use `docker compose` (v2).

## Left to the builder

- Exact component structure, state management, API response shapes beyond what's listed.
- Table library choice (TanStack suggested).
- Schema introspection SQL (Informix `systables` / `syscolumns` with `tabid > 99` or similar)
  and cache TTL.
- Test approach (unit tests for path sanitization, variable substitution, SKIP/FIRST rewrite,
  throttle-fault parsing, env cluster parsing are the minimum).
