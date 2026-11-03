# CUCM SQL Editor 1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite docker-cucm-sql as a Fastify + React app with multi-cluster AXL SQL, folder-based `.sql` query management, variables, deep links, an activity log and a run-by-URL API, fully backwards compatible with existing `.env` and `./data`.

**Architecture:** One Node 22 process (Fastify, TypeScript) serves a Vite-built React SPA and a JSON API. Saved queries are plain files under `DATA_DIR` (default `/app/data`); activity log is JSONL under `DATA_DIR/.logs`. Pure logic shared by server and browser (variables, SKIP/FIRST paging, throttle parsing) lives in `shared/`.

**Tech Stack:** Node 22, TypeScript 5.9, Fastify 5, `@fastify/static`, `cisco-axl` 2.x, `sql-formatter` 15, `archiver` (zip), Vitest; web: React 19, Vite 8, Tailwind 4, shadcn (base-nova), `@monaco-editor/react`, `@tanstack/react-table` + `@tanstack/react-virtual`, lucide-react, react-router-dom 7.

**Spec:** `docs/superpowers/specs/2026-11-03-cucm-sql-modernization-design.md`

## Global Constraints

- Saved queries are plain `.sql` files in `DATA_DIR`; existing flat files load untouched; nothing is rewritten/moved on startup.
- Config is env-only. Legacy `NODE_ENV`, `CUCM_HOSTNAME`, `CUCM_USERNAME`, `CUCM_PASSWORD`, `CUCM_VERSION` work unchanged as the default cluster; extra clusters `CUCM_<N>_{NAME,HOSTNAME,USERNAME,PASSWORD,VERSION}`, N=2.., scan stops at first missing `CUCM_<N>_HOSTNAME`. `CUCM_VERSION` must match `##.#`.
- Other env: `DATA_DIR` (default `/app/data`), `PORT` (default 3000), `QUERY_TIMEOUT` (seconds, default 60), `MAX_BATCHES` (default 200), `LOG_RETENTION_MONTHS` (default 12), `API_KEY` (optional).
- AXL usernames/passwords never appear in any API response, browser bundle, or log line.
- No app auth. Identity = `Remote-User` header, else `Remote-Name`, else `Remote-Email`, else `anonymous` — display/log only.
- Filename sanitization per path segment: `/[\\?%*:|"<>\s]/g` → `_` (same as today, `/` is the segment separator). Reject `..`, absolute paths, and any resolved path outside `DATA_DIR` (realpath check). Hidden entries (leading `.`) never listed. Extension match is case-insensitive (`.sql`/`.SQL`).
- Delete is permanent (file or folder recursive); log entry records deleted SQL text.
- Variable syntax `:name` / `:name=default`; values substituted as `'value'` with `'` doubled; `::cast` and `':x` ignored.
- Batch size `floor(suggested / 5)`; halve on re-throttle; never auto-batch; ceiling `MAX_BATCHES`.
- Runtime image `node:22-slim`, runs as UID 1000 (`USER node`), `node dist/server/index.js`. Port 3000.
- CI: push to `main` → `ghcr.io/sieteunoseis/docker-cucm-sql:main`; `v*` tag → `:latest` + `:X.Y.Z`. Version 1.0.0.
- Git identity in repo: `sieteunoseis <jeremy.worden@gmail.com>` (already configured). Work on branch `v1-rewrite`.
- UI look matches `~/development/cisco-cdr-ui` (copy its `components.json`, `globals.css`, `components/ui/*`, `lib/utils.ts`, `hooks/useTheme.ts`, Geist font).

## Review Focus

1. **Hand-edited files on the host** with CRLF line endings, a UTF-8 BOM, or `.SQL` uppercase extension → listed, loaded and run exactly as written (BOM stripped on read only). Test in Task 4.
2. **AXL returns a single row as an object, or `row` missing / empty string** → normalized to an array; 0 rows is `status:"ok", rowCount:0`, not an error. Test in Task 5.
3. **Move/rename/duplicate onto an existing name** → 409 `{error:"exists"}`, never overwrite; only `PUT` overwrites. Test in Task 4.
4. **One cluster unreachable or hanging** → that cluster returns `status:"error"` after `QUERY_TIMEOUT`, other clusters' rows still return. Test in Task 5.
5. **Deep link to a query that no longer exists** (`/q/Old/Gone`, `/api/run/Old/Gone`) → UI shows "Query not found" with editor usable; API returns 404 JSON. Tests in Tasks 7, 8, 10.

---

## File Structure

```
docker-cucm-sql/
├── package.json              # root: server deps + scripts (build, test, dev); version 1.0.0
├── tsconfig.json             # server + shared
├── vitest.config.ts
├── shared/
│   ├── variables.ts          # extractVariables, resolveVariables, missingVariables
│   ├── paging.ts             # parseThrottle, canPaginate, pageSql, batchSize
│   ├── formatSql.ts          # formatForSave(sql), used by server save + UI Format
│   └── types.ts              # API DTOs shared by server and web
├── server/
│   ├── index.ts              # entry: loadConfig → buildApp → listen
│   ├── app.ts                # buildApp(deps) Fastify factory (testable with inject)
│   ├── config.ts             # loadConfig(env) → AppConfig (clusters etc.)
│   ├── identity.ts           # identityFrom(headers)
│   ├── store.ts              # QueryStore: files/folders under DATA_DIR
│   ├── axl.ts                # ClusterRunner: run SQL on clusters, test, schema
│   ├── activityLog.ts        # ActivityLog: append/query/prune JSONL
│   └── routes/
│       ├── meta.ts           # /api/health, /api/info, /api/clusters, /api/clusters/:id/test, /api/schema
│       ├── query.ts          # POST /api/query
│       ├── queries.ts        # /api/queries*, /api/folders, export.zip
│       ├── legacy.ts         # /api/getdata, getfiles, getquery, savequery
│       ├── run.ts            # GET /api/run/*
│       └── log.ts            # GET /api/log
├── tests/server/*.test.ts, tests/shared/*.test.ts
├── web/                      # Vite app (own package.json), built to web/dist
│   └── src/{main.tsx,App.tsx,api/client.ts,components/{layout,sidebar,editor,results,palette,ui},hooks,pages/{EditorPage,LogPage}.tsx,lib}
├── data/                     # example .sql files (kept, baked into image)
├── Dockerfile, .dockerignore, docker-compose.yaml
├── .github/workflows/docker-build.yml
└── README.md, CHANGELOG.md
```

Deleted: `app.js`, `bin/`, `routes/`, `views/`, `public/`, `swagger.json` (replaced by `@fastify/swagger`).

---

### Task 1: Server scaffold, health and info

**Files:**
- Delete: `app.js`, `bin/`, `routes/`, `views/`, `public/`, `swagger.json`, `package-lock.json`
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `server/index.ts`, `server/app.ts`, `shared/types.ts`
- Test: `tests/server/app.test.ts`

**Interfaces:**
- Produces: `buildApp(deps: AppDeps): Promise<FastifyInstance>` where `AppDeps = { config: AppConfig; store?: QueryStore; runner?: ClusterRunner; log?: ActivityLog; webDist?: string }` (later tasks fill deps). `AppConfig` defined in Task 2; for now `{ version: string; clusters: [] ; ... }` stub is fine but must be the Task 2 type once it lands.
- Produces: `GET /api/health` → `{ok:true}`; `GET /api/info` → `{version, imageTag: process.env.IMAGE_TAG ?? null, clusterCount}`.
- Produces: SPA fallback — any non-`/api` GET with no file match serves `webDist/index.html`.

- [ ] **Step 1:** `git checkout -b v1-rewrite`; delete the old files listed above.
- [ ] **Step 2:** Create root `package.json` (`"version": "1.0.0"`, `"type": "module"`, scripts: `build` = `tsc -p . && npm --prefix web run build`, `test` = `vitest run`, `dev:server` = `tsx watch server/index.ts`, `start` = `node dist/server/index.js`), deps `fastify`, `@fastify/static`, `@fastify/swagger`, `@fastify/swagger-ui`, `cisco-axl@^2`, `sql-formatter@^15`, `archiver`; devDeps `typescript`, `tsx`, `vitest`, `@types/node`, `@types/archiver`. `tsconfig.json` includes `server`, `shared`; `outDir: dist`.
- [ ] **Step 3: Write failing tests** in `tests/server/app.test.ts`:
  - `health returns ok` — `app.inject GET /api/health` → 200 `{ok:true}`.
  - `info returns version and cluster count` — body `.version === "1.0.0"`, `.clusterCount === 0`.
  - `unknown /api path is JSON 404` — `GET /api/nope` → 404, JSON.
  - `SPA fallback serves index.html for /q/Some/Path` — with `webDist` = temp dir containing `index.html` "<html>spa</html>" → 200 body contains `spa`.
- [ ] **Step 4:** Run `npx vitest run tests/server/app.test.ts` → FAIL.
- [ ] **Step 5:** Implement `server/app.ts` (register swagger at `/api/docs`, static from `webDist` with `wildcard:false`, `setNotFoundHandler` → JSON 404 for `/api/*`, else `index.html`) and `server/index.ts`.
- [ ] **Step 6:** Run tests → PASS. Commit `feat: fastify scaffold with health, info, SPA fallback`.

### Task 2: Cluster config from env

**Files:**
- Create: `server/config.ts`, `server/routes/meta.ts` (clusters list only for now)
- Test: `tests/server/config.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface ClusterConfig { id: string; name: string; hostname: string; username: string; password: string; version: string }
  interface AppConfig { version: string; dataDir: string; port: number; queryTimeoutMs: number; maxBatches: number; logRetentionMonths: number; apiKey: string | null; clusters: ClusterConfig[]; defaultClusterId: string }
  function loadConfig(env: NodeJS.ProcessEnv, version: string): AppConfig  // throws ConfigError with a readable message
  function publicCluster(c: ClusterConfig): { id: string; name: string; hostname: string; version: string }
  ```
- `id` = slug of name: lowercase, non-alphanumerics → `-`, trimmed; duplicates get `-2`, `-3`.
- Produces: `GET /api/clusters` → `publicCluster[]` (default first).

- [ ] **Step 1: Write failing tests:**
  - `legacy env yields one default cluster named after hostname` — env with only the four `CUCM_*` → `clusters.length 1`, `name "brbpub01.ohsu.edu"`, `id "brbpub01-ohsu-edu"`, `defaultClusterId` equals it.
  - `CUCM_NAME sets display name` → `name "BRB"`, `id "brb"`.
  - `numbered clusters are read until first gap` — `CUCM_2_*` and `CUCM_4_*` set → 2 clusters (4 ignored).
  - `partial block throws naming missing vars` — `CUCM_2_HOSTNAME` without `CUCM_2_PASSWORD` → throws, message includes `CUCM_2_PASSWORD`.
  - `bad version throws` — `CUCM_VERSION=fourteen` → throws mentioning `##.#`.
  - `defaults` — `queryTimeoutMs 60000`, `maxBatches 200`, `logRetentionMonths 12`, `apiKey null`, `dataDir "/app/data"`.
  - `GET /api/clusters never includes username or password` — JSON string contains neither `"username"` nor the password value.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `loadConfig`, `publicCluster`, and the route; wire `loadConfig(process.env, pkg.version)` in `server/index.ts` (print `ConfigError.message` and `process.exit(1)`).
- [ ] **Step 4:** Run → PASS. Commit `feat: env-based multi-cluster config`.

### Task 3: Shared variables and paging logic

**Files:**
- Create: `shared/variables.ts`, `shared/paging.ts`
- Test: `tests/shared/variables.test.ts`, `tests/shared/paging.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface VarDef { name: string; defaultValue: string }
  function extractVariables(sql: string): VarDef[]       // port of cisco-cdr-ui SqlVariables.extractVariables, regex /:([a-zA-Z_][a-zA-Z0-9_]*)(?:=([^\s,)]+))?/g, skip if preceding char is ":" or "'"
  function resolveVariables(sql: string, values: Record<string, string>): string // value || default; quoted '…' with ' doubled; empty+no default leaves :name
  function missingVariables(sql: string, values: Record<string, string>): string[]
  interface Throttle { totalRows: number; suggestedRows: number }
  function parseThrottle(message: string): Throttle | null // /Total rows matched:\s*(\d+).*?Suggested row fetch:\s*less than\s*(\d+)/is
  function canPaginate(sql: string): { ok: true } | { ok: false; reason: string }
  function pageSql(sql: string, skip: number, first: number): string
  function batchSize(t: Throttle): number                  // Math.max(1, Math.floor(t.suggestedRows / 5))
  ```

- [ ] **Step 1: Write failing tests:**
  - `extracts name and default, dedupes` — `"where a=:dn and b=:pt=Internal and c=:dn"` → `[{dn,""},{pt,"Internal"}]`.
  - `ignores casts and quoted` — `"x::INTEGER, ':notvar'"` → `[]`.
  - `resolves with quoting` — `resolveVariables("a=:n", {n:"O'Neil"})` → `"a='O''Neil'"`.
  - `uses default when value empty` — `":pt=Internal"`, `{}` → `"'Internal'"`.
  - `missing lists only no-default empties` — `":a and :b=1"`, `{}` → `["a"]`.
  - `parses CUCM throttle fault` — `"Query request too large. Total rows matched: 2816 rows. Suggested row fetch: less than 844 rows"` → `{2816, 844}`; `batchSize` → `168`.
  - `pageSql inserts SKIP FIRST after SELECT` — `"select name from device"` (0,100) → `"select SKIP 0 FIRST 100 name from device"`; leading whitespace/comments preserved; `SELECT DISTINCT x` → `SELECT SKIP 0 FIRST 100 DISTINCT x`.
  - `canPaginate refuses` top-level `UNION`, `INTERSECT`, `MINUS`, existing `SKIP`, `FIRST`, `LIMIT` (reason text names the keyword); allows `UNION` inside a subquery parenthesis; ignores keywords in string literals and `--` comments.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. `canPaginate`: strip `'…'` literals and `--…$` comments, track paren depth, check keywords at depth 0 with word boundaries.
- [ ] **Step 4:** Run → PASS. Commit `feat: shared variables and SKIP/FIRST paging`.

### Task 4: Query store (files, folders, formatter)

**Files:**
- Create: `server/store.ts`, `shared/formatSql.ts`
- Test: `tests/server/store.test.ts`, `tests/shared/formatSql.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type QueryPath = string // "Phones/Phones_with_DN" — no extension, "/" separated
  interface TreeNode { type: "folder" | "query"; name: string; path: QueryPath; description?: string; children?: TreeNode[] }
  class StoreError extends Error { code: "invalid" | "not_found" | "exists" }
  class QueryStore {
    constructor(dataDir: string)
    sanitizePath(input: string): QueryPath           // per-segment sanitize; throws invalid
    tree(): Promise<TreeNode[]>                       // folders first, then queries, each localeCompare-sorted
    read(path: QueryPath): Promise<string>            // strips leading BOM
    write(path: QueryPath, sql: string): Promise<void> // creates parent dirs; overwrites
    move(from: QueryPath, to: QueryPath): Promise<void>      // file or folder; exists → StoreError("exists")
    duplicate(from: QueryPath, to: QueryPath): Promise<void> // file only
    remove(path: QueryPath): Promise<{ deletedSql: Record<QueryPath, string> }> // file or folder recursive
    createFolder(path: QueryPath): Promise<void>
    countQueries(path: QueryPath): Promise<number>   // for folder delete confirm
  }
  function formatForSave(sql: string): string
  ```
- A path names a query if `<path>.sql` (any case) exists, else a folder if the dir exists.
- `description` = text after the first line matching `/^--\s*description:\s*(.+)$/im`.

- [ ] **Step 1: Write failing store tests** (temp dir per test):
  - `lists existing flat files untouched` — seed `Show_Nodes.sql`, `Campus_Operators_-_All_IT.CALL_devices.sql`, `.DS_Store`, `.logs/2026-11.jsonl` → tree has exactly the two queries with paths `Show_Nodes` and `Campus_Operators_-_All_IT.CALL_devices`; file mtimes unchanged.
  - `lists uppercase .SQL and nested folders` — `A/b.SQL` → folder `A` with child path `A/b`.
  - `read strips BOM and preserves CRLF` — file bytes `﻿SELECT 1\r\nFROM x` → `"SELECT 1\r\nFROM x"`.
  - `sanitizes segments` — `sanitizePath("My Folder/a b?c")` → `"My_Folder/a_b_c"`.
  - `rejects traversal` — `"../etc/passwd"`, `"/abs"`, `"a/../../x"` → StoreError invalid; a symlink inside dataDir pointing outside → invalid on read.
  - `move onto existing returns exists` — move `a`→`b` where `b.sql` exists → code `exists`, both files intact.
  - `move folder` — `F/x.sql` move `F`→`G` → `G/x` readable, `F` gone.
  - `duplicate onto existing returns exists`.
  - `remove folder returns deleted sql` — `F/x.sql`,`F/y.sql` → `deletedSql` has both keys; folder gone.
  - `description parsed` — file starting `-- description: Phones in a pool\nSELECT …` → node `.description === "Phones in a pool"`.
  - `not_found on missing read`.
- [ ] **Step 2: Write failing formatter tests:**
  - `keeps variable defaults intact` — `formatForSave("select * from device where name like :pat=SEP% and x=:y")` contains `:pat=SEP%` and `:y`.
  - `keeps :: casts` — `"select x::INTEGER from t"` contains `::INTEGER`.
  - `uppercases keywords` — contains `SELECT` and `FROM`.
  - `returns input unchanged on formatter failure`.
- [ ] **Step 3:** Run both → FAIL.
- [ ] **Step 4:** Implement. `formatForSave`: `format(sql, { language: "transactsql", keywordCase: "upper", linesBetweenQueries: 2, paramTypes: { named: [":"] } })`; if output still breaks `:name=default` (test fails), protect tokens by replacing each `extractVariables` match with a placeholder before formatting and restoring after (import `extractVariables` from `shared/variables.ts`, Task 3).
- [ ] **Step 5:** Run → PASS. Commit `feat: file-backed query store with folders`.

### Task 5: Cluster runner and query/meta routes

**Files:**
- Create: `server/axl.ts`, `server/routes/query.ts`; Modify: `server/routes/meta.ts`
- Test: `tests/server/axl.test.ts`, `tests/server/query-routes.test.ts`

**Interfaces:**
- Consumes: `AppConfig`, `ClusterConfig` (Task 2); `parseThrottle` (Task 3).
- Produces:
  ```ts
  type Row = Record<string, string>
  interface ClusterResult { clusterId: string; status: "ok" | "error" | "throttled"; columns: string[]; rows: Row[]; rowCount: number; durationMs: number; error?: string; throttle?: Throttle }
  interface AxlClient { executeSqlQuery(sql: string): Promise<any> }
  class ClusterRunner {
    constructor(clusters: ClusterConfig[], timeoutMs: number, clientFactory?: (c: ClusterConfig) => AxlClient)
    run(sql: string, clusterIds: string[]): Promise<ClusterResult[]>  // allSettled, one per id, order preserved
    test(clusterId: string): Promise<{ ok: boolean; latencyMs: number; version?: string; error?: string }>
    schema(clusterId: string): Promise<Record<string, { name: string; type: string }[]>> // cached 1h per cluster
  }
  ```
- Routes: `POST /api/query {sql, clusters?: string[]}` → `{ results: ClusterResult[] }` (default cluster if omitted; unknown id → 400); `GET /api/clusters/:id/test`; `GET /api/schema?cluster=id`.
- Columns = union of keys in first-seen order; `undefined`/`null` → `""`. Non-string values `String()`'d. AXL errors: message from `AXLOperationError.message`; throttled when `parseThrottle` matches. Timeout via `Promise.race` → `status:"error", error:"Timed out after 60s"`.
- `test` runs `select first 1 name from processnode`; version from `select first 1 version from componentversion where softwarecomponent='master'` (best-effort; omit on failure).
- `schema` SQL: `select t.tabname, c.colname, c.coltype from systables t, syscolumns c where t.tabid = c.tabid and t.tabid > 99 and t.tabtype = 'T'`; map coltype → name with a small table (0 char, 1 smallint, 2 integer, 6 serial, 10 datetime, 13 varchar, 40/41 lvarchar/boolean; mask `& 0xFF`, else `"other"`).
- Wire `query` events to the ActivityLog in Task 6 (leave a `onRun?` hook in route options now).

- [ ] **Step 1: Write failing tests** (fake `clientFactory`):
  - `normalizes single-row object` — client returns `{row:{name:"a"}}` → rows `[{name:"a"}]`.
  - `empty result is ok with 0 rows` — `{}`, `{row:""}`, `null` → `status ok`, `rowCount 0`.
  - `undefined becomes empty string` — `{row:[{a:undefined,b:"1"}]}` → `{a:"",b:"1"}`.
  - `one cluster failing doesn't fail others` — cluster a throws, b returns rows → `[error, ok]`.
  - `timeout` — client never resolves, timeout 50 ms → `status error`, error contains `Timed out`; other cluster ok.
  - `throttle detected` — throws Error with the fault text → `status throttled`, `throttle {2816,844}`.
  - `route rejects unknown cluster id` → 400.
  - `route response contains no password` — password string absent from body even when error message from client echoes nothing sensitive (assert config password not in JSON).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; default `clientFactory` = `new axlService(host, user, pass, version)` (cache one per cluster).
- [ ] **Step 4:** Run → PASS. Commit `feat: concurrent multi-cluster AXL runner`.

### Task 6: Activity log

**Files:**
- Create: `server/activityLog.ts`, `server/identity.ts`, `server/routes/log.ts`; Modify: `server/routes/query.ts` (log runs)
- Test: `tests/server/activityLog.test.ts`

**Interfaces:**
- Produces:
  ```ts
  function identityFrom(headers: Record<string, string | string[] | undefined>): string
  type LogAction = "run" | "save" | "move" | "duplicate" | "delete" | "folder_create"
  interface LogEntry { id: string; ts: string; user: string; action: LogAction; source: "ui" | "api"; path?: string; to?: string; sql?: string; deletedSql?: Record<string, string>; clusters?: { id: string; status: string; rowCount: number; durationMs: number; error?: string }[] }
  class ActivityLog {
    constructor(dir: string /* DATA_DIR/.logs */, retentionMonths: number, now?: () => Date)
    append(e: Omit<LogEntry, "id" | "ts">): Promise<LogEntry>   // appendFile to YYYY-MM.jsonl (UTC)
    query(f: { user?: string; action?: LogAction; q?: string; from?: string; to?: string; cursor?: string; limit?: number }): Promise<{ entries: LogEntry[]; nextCursor: string | null }> // newest first, limit default 50
    prune(): Promise<string[]>  // deletes files older than retention; returns deleted names
  }
  ```
- `id` = `${ts}-${random6}`; cursor = last returned `id`. `q` matches `sql`, `path`, `user` case-insensitively.
- `POST /api/query` accepts optional `path` (saved query it came from) and logs one `run` entry with resolved SQL and per-cluster summary (no rows).
- `GET /api/log` → query result. `prune()` runs once at startup in `server/index.ts`.

- [ ] **Step 1: Write failing tests:**
  - `identity order` — `{"remote-user":"jw"}` → `jw`; only `remote-email` → email; none → `anonymous`.
  - `append writes month file` — now=2026-11-03 → `.logs/2026-11.jsonl` has 1 JSON line.
  - `query newest first across months with cursor paging` — 3 entries in Oct, 2 in Nov, limit 2 → pages `[N2,N1]`,`[O3,O2]`,`[O1]`, then `nextCursor null`.
  - `filters` by user, action, q (substring in sql), from/to.
  - `prune keeps retention` — retention 12, now 2026-11 → `2025-10.jsonl` deleted, `2025-11.jsonl` kept.
  - `run route logs entry without rows or credentials` — after `POST /api/query`, log entry has `sql`, `clusters[0].rowCount`, no `rows` key, no password substring.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** PASS. Commit `feat: JSONL activity log`.

### Task 7: Saved-query routes, legacy routes, export

**Files:**
- Create: `server/routes/queries.ts`, `server/routes/legacy.ts`
- Test: `tests/server/queries-routes.test.ts`, `tests/server/legacy-routes.test.ts`

**Interfaces:**
- Consumes: `QueryStore` (Task 4), `formatForSave` (`shared/formatSql.ts`, Task 4), `ActivityLog`, `identityFrom` (Task 6), `ClusterRunner` (Task 5).
- Produces (all JSON; `StoreError` → invalid 400, not_found 404, exists 409 `{error, message}`):
  - `GET /api/queries` → `{ tree: TreeNode[] }`
  - `GET /api/queries/*` → `{ path, sql }`
  - `PUT /api/queries/*` `{sql}` → `{ path }` (formatted via `formatForSave`; logs `save`)
  - `POST /api/queries/move` `{from, to}` → `{ path: to }` (logs `move`)
  - `POST /api/queries/duplicate` `{from, to}` → `{ path: to }` (logs `duplicate`)
  - `DELETE /api/queries/*` → `{ deleted: string[] }` (logs `delete` with `deletedSql`)
  - `GET /api/queries-count/*` → `{ count }` (for folder-delete confirm)
  - `POST /api/folders` `{path}` → `{ path }` (logs `folder_create`)
  - `GET /api/export.zip` → `application/zip`, all `.sql` with folders, no hidden entries
  - (Move/duplicate use body paths instead of `*/move` suffix so query names can't collide with action words — deviation from spec's suggested shape, allowed by "shape is builder's call".)
- Legacy (same shapes as old code): `POST /api/getdata {query}` → old AXL shape `{row:[...]}` from default cluster, 204 `{message:"No data"}` on empty, 500 on error; `GET /api/getfiles` → `string[]` of top-level `*.sql` filenames with extension, sorted; `GET /api/getquery/:name` → `{fileName, data}` or 500 `{message:"No file found"}`; `POST /api/savequery {fileName, query}` → 200 text `"Successfully saved file"` (top-level, sanitized, formatted).

- [ ] **Step 1: Write failing tests:** one per route above for the happy path; plus `move onto existing → 409`; `GET /api/queries/Old/Gone → 404 JSON`; `PUT with ../ → 400`; `export.zip contains A/b.sql and excludes .logs` (unzip with `yauzl`/`adm-zip` devDep); legacy `getfiles` excludes nested files; `getquery` of existing `Show_Nodes.sql` returns `{fileName:"Show_Nodes.sql", data}`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. Commit `feat: saved-query, legacy and export routes`.

### Task 8: Run-by-URL API

**Files:**
- Create: `server/routes/run.ts`
- Test: `tests/server/run-route.test.ts`

**Interfaces:**
- Consumes: `QueryStore.read`, `resolveVariables`, `missingVariables`, `ClusterRunner.run`, `ActivityLog.append`, `identityFrom`.
- Produces: `GET /api/run/*?cluster=a,b&format=json|csv&<var>=<value>`:
  - Auth: if `config.apiKey` set and no `remote-user` header → require `Authorization: Bearer <apiKey>` else 401 `{error:"unauthorized"}`.
  - 404 missing query; 400 `{error:"missing_variables", missing:[…]}`; 400 unknown cluster.
  - Any cluster throttled → 413 `{error:"too_large", clusters:[{id,totalRows,suggestedRows}]}`.
  - json: `{columns, rows, clusters:[{id,status,rowCount,durationMs,error?}]}`; with >1 cluster each row gets leading `cluster` key and `columns[0]==="cluster"`.
  - csv: header + rows, RFC 4180 quoting, `Content-Type: text/csv`, `Content-Disposition: attachment; filename="<last segment>.csv"`.
  - Logs `run` with `source:"api"`, user = identity, or `api-key` when authorized by key.

- [ ] **Step 1: Write failing tests:** `runs saved query with variables`, `multi-cluster adds cluster column`, `csv format`, `missing variable 400 lists names`, `404 for Old/Gone`, `api key required when set and no remote-user`, `remote-user bypasses api key`, `throttle returns 413`, `logs source api`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. Commit `feat: run saved query by URL`.

### Task 9: Web scaffold, layout, theme, API client

**Files:**
- Create: `web/package.json`, `web/vite.config.ts` (alias `@` → `src`, `@shared` → `../shared`; dev proxy `/api` → `http://localhost:3000`; `base: "./"`), `web/tsconfig*.json`, `web/index.html`, `web/components.json`, `web/src/{main.tsx,App.tsx,globals.css}`, `web/src/components/ui/*`, `web/src/lib/utils.ts`, `web/src/hooks/useTheme.ts` (all copied from `~/development/cisco-cdr-ui/src`), `web/src/components/layout/{Header,Layout,Footer}.tsx`, `web/src/api/client.ts`
- Test: `web/src/api/client.test.ts` (vitest + jsdom)

**Interfaces:**
- Consumes: `shared/types.ts` DTOs; all server routes.
- Produces: `api` object in `client.ts` with one typed function per route: `getClusters, testCluster, getSchema, runQuery({sql, clusters, path?}), getTree, readQuery, saveQuery, moveQuery, duplicateQuery, deleteQuery, countQueries, createFolder, getLog(filters), getInfo`; non-2xx throws `ApiError { status: number; code?: string; message: string }`.
- Routes in `App.tsx`: `/` and `/q/*` → `EditorPage`; `/log` → `LogPage`. Header nav: "Editor" (`/`, active also on `/q/*`), "Log" (`/log`); title "CUCM SQL"; theme toggle. Footer shows `v{version}` from `getInfo`.
- Use relative `api/...` fetch paths resolved against `document.baseURI` (`base: "./"`) so the app works behind a path prefix.

- [ ] **Step 1: Failing test:** `client throws ApiError with status and code on 409` (mock fetch returning `{error:"exists",message:"…"}`).
- [ ] **Step 2:** FAIL. **Step 3:** Implement scaffold + client; placeholder pages.
- [ ] **Step 4:** Test PASS; `npm --prefix web run build` succeeds; run `npm run build && PORT=3000 DATA_DIR=./data CUCM_… node dist/server/index.js` and open `/q/anything` → SPA loads with header. Commit `feat: web scaffold with cdr-ui look`.

### Task 10: Saved-query sidebar and management

**Files:**
- Create: `web/src/components/sidebar/{QueryTree,QueryTreeNode,QueryDialogs}.tsx`, `web/src/hooks/useQueryTree.ts`
- Test: `web/src/components/sidebar/QueryTree.test.tsx` (Testing Library)

**Interfaces:**
- Consumes: `api.getTree/readQuery/saveQuery/moveQuery/duplicateQuery/deleteQuery/countQueries/createFolder`.
- Produces: `<QueryTree selectedPath={string|null} onOpen={(path) => void} />` and `useQueryTree(): { tree, refresh, error }`.
- Behavior: collapsible folders (expanded state per path in `localStorage`, try/catch); filter box (matches name or description, auto-expands matching folders); description as muted second line; per-item menu (shadcn dropdown): Rename, Move to… (folder picker incl. root), Duplicate, Copy link (`${location.origin}${base}q/<path>`), Delete; folder menu adds New folder, and Delete confirm shows "Delete folder X and N queries?" via `countQueries`. Errors from API (409 exists, 400 invalid) shown inline in the dialog. Deleting the open query clears selection and shows a toast; URL goes to `/`.

- [ ] **Step 1: Failing tests:** `renders folders before queries`, `filter shows matching nested query and its folder`, `rename onto existing shows "already exists"` (mock 409), `folder delete confirm shows query count`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. Commit `feat: saved-query tree with folder management`.

### Task 11: Editor page — clusters, Monaco, variables, URLs, keyboard

**Files:**
- Create: `web/src/pages/EditorPage.tsx`, `web/src/components/editor/{SqlEditor,ClusterPicker,VariablesBar,Toolbar}.tsx`, `web/src/components/palette/CommandPalette.tsx`, `web/src/hooks/{useUrlState,useSchema}.ts`
- Test: `web/src/hooks/useUrlState.test.ts`, `web/src/components/editor/VariablesBar.test.tsx`

**Interfaces:**
- Consumes: `extractVariables`, `resolveVariables`, `missingVariables` (`@shared/variables`); `api.getClusters/testCluster/getSchema/readQuery/saveQuery`; `QueryTree` (Task 10); `ResultsPanel` (Task 12, props `{ sql: string; clusters: string[]; path?: string; runToken: number }`).
- Produces: `useUrlState(): { path: string|null; clusters: string[]; vars: Record<string,string>; autorun: boolean; buildLink(state): string }` — parses `/q/<path>`, `?cluster=a,b`, `?run=1`, every other key → var.
- Behavior:
  - `SqlEditor`: adapt cdr-ui `SqlEditor.tsx` (Monaco, theme-synced, `sql` language, completions from `useSchema(firstSelectedCluster)` for table names and `table.` column names). `Ctrl/Cmd+Enter` run, `Ctrl/Cmd+S` save (prevent browser save), dirty marker when editor text ≠ loaded file.
  - `ClusterPicker`: multi-select chips; default = `defaultClusterId` or URL `cluster`; each shows status dot from `testCluster` (gray pending, green ok w/ latency tooltip, red error tooltip), tested once on load.
  - `VariablesBar`: port of cdr-ui `SqlVariables` UI; initial values from URL vars; empty + no default inputs get red ring and Run is disabled with tooltip "Fill in :name"; help text notes values are always quoted.
  - Toolbar: Run, Format (`formatForSave` from `@shared/formatSql`), Save (new → dialog for path incl. folder picker; loaded → overwrite), Save as, Clear, Copy link (current path + clusters + var values; disabled for unsaved).
  - `/q/<missing>` → banner "Query not found: <path>", editor empty and usable.
  - `?run=1` runs once after query + clusters load.
  - `CommandPalette` (`Ctrl/Cmd+K`): fuzzy list of saved queries (open) and actions (Run, Format, Save, New query, Go to Log, Toggle theme).

- [ ] **Step 1: Failing tests:** `useUrlState parses path, clusters, vars and run` from `/q/Phones/Phones_with_DN?cluster=brb,lab&dn=1234&run=1`; `buildLink round-trips`; `VariablesBar disables run and marks empty required var`; `URL var prefills input`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; manual check in browser against dev CUCM (`npm run dev:server` + `npm --prefix web run dev`). Commit `feat: editor page with clusters, variables, deep links`.

### Task 12: Results panel, status chips, batching, CSV

**Files:**
- Create: `web/src/components/results/{ResultsPanel,ResultsGrid,ClusterStatusChips,BatchFetch}.tsx`, `web/src/lib/csv.ts`, `web/src/hooks/useRun.ts`
- Test: `web/src/hooks/useRun.test.ts`, `web/src/lib/csv.test.ts`

**Interfaces:**
- Consumes: `api.runQuery`; `canPaginate`, `pageSql`, `batchSize` (`@shared/paging`); `maxBatches` from `getInfo` (add `maxBatches` to `/api/info` response in this task).
- Produces: `useRun(): { results: ClusterResult[]; running: boolean; run(sql, clusters, path?): Promise<void>; fetchAll(clusterId): Promise<void>; cancel(): void; progress?: { clusterId: string; batch: number; total: number } }`.
- Behavior:
  - Merged rows: if >1 cluster selected, leading `cluster` column (cluster name).
  - `ClusterStatusChips`: per cluster "N rows · 708 ms" / red error with full Informix message / amber "Too large: 2,816 rows" + button "Fetch all 2,816 in 17 batches" or the `canPaginate` reason.
  - `fetchAll`: loop `skip += size` calling `runQuery(pageSql(sql, skip, size), [clusterId])`; on throttle halve size (min 1) and retry same skip; stop at `totalRows`, on cancel, or after `maxBatches` (show "Stopped after 200 batches"); replace that cluster's rows only.
  - `ResultsGrid`: TanStack table + virtualizer; header click sort (numeric-aware `localeCompare`), per-column filter inputs, global search, column visibility menu, sticky header; "Export CSV" exports filtered+sorted visible columns, filename `<query name or "query">-YYYYMMDD-HHmm.csv`.

- [ ] **Step 1: Failing tests:** `fetchAll batches with floor(suggested/5)` (mock: throttle 2816/844 → 17 calls of 168, rows concatenated = 2816); `fetchAll halves on rethrottle`; `fetchAll stops at maxBatches`; `cancel stops loop`; `csv quotes commas quotes and newlines`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; manual check: 20k-row query scrolls smoothly. Commit `feat: results grid with batching and CSV`.

### Task 13: Log page

**Files:**
- Create: `web/src/pages/LogPage.tsx`
- Test: `web/src/pages/LogPage.test.tsx`

**Interfaces:**
- Consumes: `api.getLog`.
- Behavior: filters (user text, action select, search text, from/to date) synced to URL query string; newest-first table: time (local), user, action badge (`text-bg-*` style via shadcn badge variants), source, query path (link to `/q/<path>`), clusters with rows/duration/status, SQL truncated to 120 chars with expand; "Load more" via `nextCursor`. Run row action "Open in editor" opens new tab to `/` with SQL passed via `sessionStorage` key `cucm-sql:open:<id>` and `?open=<id>` (EditorPage reads and clears it; unsaved SQL isn't in URLs per spec). Delete rows show "Restore" which opens deleted SQL the same way.

- [ ] **Step 1: Failing tests:** `renders entries and loads more with cursor`, `filters update request params`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement (+ `?open=` handling in EditorPage). **Step 4:** PASS. Commit `feat: activity log page`.

### Task 14: Docker, CI, docs, release prep

**Files:**
- Modify: `Dockerfile`, `.dockerignore`, `docker-compose.yaml`, `.github/workflows/docker-build.yml`, `README.md`; Create: `CHANGELOG.md`, `.env.example`

**Interfaces:** none new.

- [ ] **Step 1: Dockerfile** multi-stage: `node:22-slim` build stage (`npm ci`, `npm --prefix web ci`, `npm run build`), runtime stage `node:22-slim`, `NODE_ENV=production`, `npm ci --omit=dev`, copy `dist/`, `web/dist/`, `data/` → `/app/data`, `chown -R node:node /app`, `USER node`, `EXPOSE 3000`, `ARG IMAGE_TAG` → `ENV IMAGE_TAG`, `CMD ["node","dist/server/index.js"]`, `HEALTHCHECK` curl-less: `node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`.
- [ ] **Step 2: Verify image:** `docker build -t cucm-sql:test . && docker run --rm -d --name cucm-sql-test -p 3099:3000 --user 1000:1000 --env-file ~/development/biccapps-docker-compose/cucm-sql/.env -v /tmp/cucm-sql-data-copy:/app/data cucm-sql:test` (data = `cp -a` of prod data); expect `curl localhost:3099/api/health` → `{"ok":true}`, `curl localhost:3099/api/getfiles` lists the prod files, a saved file on disk is owned by 1000. Stop container.
- [ ] **Step 3: CI** workflow: trigger on push to `main` and tags `v*`; `npm ci && npm test` job before build; `docker/metadata-action` tags: `type=raw,value=main,enable={{is_default_branch}}` on branch pushes, `type=semver,pattern={{version}}` + `type=raw,value=latest` on `v*` tags only; push to `ghcr.io/${{ github.repository }}`; pass `IMAGE_TAG` build-arg; keep trivy scan.
- [ ] **Step 4: Docs:** README — features, screenshots placeholder, env table (all vars in Global Constraints), multi-cluster example, folders, deep links, variables (incl. always-quoted note), `/api/run` usage with curl + Authelia bypass note + `API_KEY`, activity log + retention, Docker Hub → GHCR move notice, Support section (Buy Me a Coffee badge from CLAUDE.md) before License. `CHANGELOG.md` `## [1.0.0] - <release date>` Added/Changed/Removed (Handsontable, Docker Hub publishing). `.env.example` with legacy + `CUCM_2_*` sample. Compose example uses `ghcr.io/sieteunoseis/docker-cucm-sql:latest`.
- [ ] **Step 5:** `npm test` all PASS; `npx tsc -p . --noEmit` and `npm --prefix web run lint` clean. Commit `chore: docker, CI tags, docs for 1.0.0`.
- [ ] **Step 6:** Push branch, open PR to `main` (needs user go-ahead). After merge, CI publishes `:main` only.

### Task 15: Test deployment and prod cutover (user-gated)

**Files:**
- Modify: `~/development/biccapps-docker-compose/cucm-sql/docker-compose.yaml` (OHSU repo, identity wordenj); Authelia access-control config for the bypass (locate in `~/development/biccapps-docker-compose/authelia*`).

- [ ] **Step 1:** Add a `cucm-sql-test` service using `ghcr.io/sieteunoseis/docker-cucm-sql:main`, `com.centurylinklabs.watchtower.enable=false` label, copy of `./data` at `./data-test`, same `.env`; route through nginx only if user wants a hostname — else `docker compose run`/port-map locally. Verify: existing queries list, a query runs on brbpub01, save/rename/delete in `data-test`, Log page shows Authelia user.
- [ ] **Step 2:** Show user the results; **wait for approval**.
- [ ] **Step 3:** Tag release `git tag v1.0.0 && git push origin v1.0.0` → CI publishes `:latest`/`:1.0.0`.
- [ ] **Step 4:** Switch prod service image to `ghcr.io/sieteunoseis/docker-cucm-sql:latest`, add `API_KEY` to `.env`, add Authelia bypass rule for `^/api/run/` on the cucm-sql domain; `docker compose pull && docker compose up -d`; remove `cucm-sql-test` and `data-test`. Verify `/api/info` shows `1.0.0`, queries list, `curl -H "Authorization: Bearer $API_KEY" https://<host>/api/run/Show_Nodes?format=csv` returns CSV.
- [ ] **Step 5:** Commit compose change in biccapps-docker-compose (wordenj identity) — only with user go-ahead.
