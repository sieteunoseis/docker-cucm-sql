# Cisco CUCM SQL Editor

A web-based SQL editor for Cisco Unified Communications Manager. Write SQL, run it against one or more CUCM clusters through the AXL `executeSQLQuery` API, and save your queries as plain `.sql` files that the whole team can share.

## Features

- **Multiple clusters**: run one query on several CUCM clusters at once. Each row is tagged with the cluster it came from, and a cluster that fails doesn't stop the others.
- **Saved queries are plain `.sql` files** in the data folder. You can organize them into folders, and rename, move, duplicate or delete them in the UI. You can also edit the files on the host directly.
- **Monaco editor** with table and column autocomplete loaded from the cluster's own schema. Table aliases are supported, so `d.` works after `from device d`.
- **Variables**: write `:name` or `:name=default` in a query and fill in the values above the results.
- **Links to queries**: every saved query has a URL, and the URL can also pick the clusters, fill in variables and run the query.
- **Results grid**: sort, filter by column, search everything, hide columns and export CSV. It stays fast with tens of thousands of rows.
- **Large results**: when a query hits UCM's 8 MB response limit, one click fetches everything in `SKIP/FIRST` batches.
- **Activity log**: who ran or changed what, read from the [Authelia](https://www.authelia.com/) `Remote-User` header.
- **Run-by-URL API**: `GET /api/run/<query>` returns JSON or CSV for scripts, Grafana, Excel or Windmill.
- Keyboard shortcuts: `Ctrl/Cmd+Enter` runs, `Ctrl/Cmd+S` saves and `Ctrl/Cmd+K` opens a command palette. There's also a light/dark theme.

## Quick start

```bash
cp .env.example .env   # set your CUCM details
docker compose up -d   # http://localhost:3000
```

Or with `docker run`:

```bash
docker run -d -p 3000:3000 --name cucm-sql-editor --restart=always \
  --env-file=.env -v cucm-sql-data:/app/data \
  ghcr.io/sieteunoseis/docker-cucm-sql:latest
```

A new named volume starts with the example queries from this repo's [`data/`](data/) folder.

### Image tags

| Tag | Built from |
|-----|------------|
| `latest`, `X.Y.Z` | release tags (`vX.Y.Z`) |
| `main` | every push to `main` (testing only, may be unstable) |

### Upgrading from 0.x

- **The image has moved** from Docker Hub (`sieteunoseis/cucm-sql-editor`) to GHCR (`ghcr.io/sieteunoseis/docker-cucm-sql`). The Docker Hub image is no longer updated.
- **The container now runs as UID 1000 instead of root.** If your data volume was created by 0.x, give it to UID 1000 once, or saving queries and the activity log will fail. The container prints this same warning at startup when the folder isn't writable:
  ```bash
  docker run --rm -v cucm-sql-data:/d alpine chown -R 1000:1000 /d   # named volume
  sudo chown -R 1000:1000 ./data                                      # bind mount
  ```
- **Your existing `.env` works unchanged.** The `CUCM_*` variables become the default cluster.
- **Your existing `data/*.sql` files show up as they are**, at the top level of the query list. Nothing is rewritten or moved.
- **The 0.x API routes still work**: `/api/getdata`, `/api/getfiles`, `/api/getquery/:name` and `/api/savequery`.

## Configuration

Configuration is environment variables only.

| Variable | Default | Description |
|----------|---------|-------------|
| `CUCM_HOSTNAME` | required | Default cluster's publisher |
| `CUCM_USERNAME` | required | AXL user |
| `CUCM_PASSWORD` | required | AXL password |
| `CUCM_VERSION` | required | AXL schema version, `##.#` (e.g. `14.0`) |
| `CUCM_NAME` | hostname | Display name for the default cluster |
| `CUCM_<N>_NAME`, `_HOSTNAME`, `_USERNAME`, `_PASSWORD`, `_VERSION` | | Additional clusters, `N` = 2, 3, … (read until the first missing `CUCM_<N>_HOSTNAME`) |
| `QUERY_TIMEOUT` | `60` | Seconds before a cluster's request is abandoned |
| `MAX_BATCHES` | `200` | Most `SKIP/FIRST` batches one "fetch all" may send |
| `LOG_RETENTION_MONTHS` | `12` | Months of activity log kept |
| `API_KEY` | | When set, every `/api/run` call must send `Authorization: Bearer <key>` |
| `DATA_DIR` | `/app/data` | Folder holding queries and logs |
| `PORT` | `3000` | HTTP port |

AXL passwords are never sent to the browser or written to the log.

### Multiple clusters

```bash
CUCM_NAME=Production
CUCM_HOSTNAME=cucm-pub.example.com
CUCM_USERNAME=axluser
CUCM_PASSWORD=...
CUCM_VERSION=14.0

CUCM_2_NAME=Lab
CUCM_2_HOSTNAME=cucm-lab.example.com
CUCM_2_USERNAME=axluser
CUCM_2_PASSWORD=...
CUCM_2_VERSION=15.0
```

Each cluster's id is its name as a slug (`Production` → `production`). That id is what you use in URLs, e.g. `?cluster=production,lab`.

## Saved queries

- A query is a file at `data/<folder>/<name>.sql`. Folders can be nested to any depth.
- Spaces and the characters `\ ? % * : | " < >` in names become `_`.
- Files and folders starting with `.` are hidden from the list.
- An optional first line `-- description: …` is shown under the query's name in the sidebar.
- Names you create are cleaned up as described above. Files made by hand with spaces or other special characters still open, rename and delete normally.
- **Saving under a name that's already taken asks before replacing it.** The Log keeps the replaced SQL, and **Restore previous version** opens it in the editor.
- Saving runs the SQL formatter. Variables and `::` casts are left exactly as written.
- **Deletes are permanent.** The activity log keeps the deleted SQL, and the Log page has a **Restore** button that opens it in the editor.

Back up the data folder from the host with any file tool.

## Variables

```sql
SELECT d.name, n.dnorpattern
FROM device d, devicenumplanmap m, numplan n
WHERE d.pkid = m.fkdevice AND m.fknumplan = n.pkid
  AND n.dnorpattern LIKE :pattern=1234%
```

- Each variable gets an input field below the editor. A variable with no default has to be filled in before Run is enabled.
- Values are always sent quoted, as `'value'` with any `'` doubled. Informix converts them where it compares against a number column. It can't convert them where a bare number is required, for example `FIRST :n`.

## Links

| URL | Opens |
|-----|-------|
| `/q/Phones/Phones_with_DN` | That saved query |
| `…?cluster=production,lab` | The query with those clusters selected |
| `…?pattern=5551%` | The query with variables filled in |
| `…?run=1` | The query, and runs it immediately |

The **Copy link** button builds a link from the current query, the selected clusters and the variable values.

## Large result sets

UCM rejects any `executeSQLQuery` response over 8 MB with a fault like `Total rows matched: 38558 rows. Suggestive Row Fetch: less than 896 rows`. When that happens:

- The editor offers to fetch the full result in batches, adding `SELECT SKIP n FIRST m` to the query.
- Each batch is one fifth of the size UCM suggests. If a batch is still too large, the size is halved and the batch is retried.
- Batching only starts when you click, and it can be cancelled.
- It stops after `MAX_BATCHES` batches. The button tells you up front when the limit will cut a fetch short.
- Queries with a top-level `UNION`/`INTERSECT`/`MINUS`, or their own `SKIP`/`FIRST`/`LIMIT`, aren't batched. The editor shows the reason instead.

## Run-by-URL API

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://cucm-sql.example.com/api/run/Phones/Phones_with_DN?cluster=production&pattern=5551%25&format=csv"
```

- **Variables:** any query-string key except `cluster` and `format` fills a variable.
- **Formats:**
  - `format=json` (the default) returns `{columns, rows, clusters}`.
  - `format=csv` returns a CSV download.
- **Errors:**
  - `400` lists any missing variables.
  - `404` means no saved query has that name.
  - `413` means the result is over UCM's 8 MB limit. This endpoint never batches.
- **Logging:** every call is recorded in the activity log with source `api`.

**Behind Authelia:** scripts can't complete Authelia's login, so add an Authelia `bypass` rule for `^/api/run/` on this host. Then set `API_KEY` so the bypassed endpoint isn't open to everyone. When `API_KEY` is set it's required even if a `Remote-User` header is present, because a client can send that header itself. When the app runs behind a proxy, don't also publish port 3000, which would bypass Authelia.

Full API documentation (Swagger) is at `/api/docs`.

## Activity log

The **Log** page lists who ran, saved, moved, duplicated or deleted which query, newest first. You can filter by user, action, text and date.

- **Who:** taken from the `Remote-User` header set by Authelia, falling back to `Remote-Name`, then `Remote-Email`, then `anonymous`.
- **Storage:** monthly JSON Lines files in `data/.logs/`. Files older than `LOG_RETENTION_MONTHS` are removed at startup.

## Development

```bash
npm install && npm --prefix web install
cp .env.example .env && set -a && . ./.env && set +a
DATA_DIR=./data npm run dev:server      # API on :3000
npm --prefix web run dev                # UI on :5173 (proxies /api)
npm test                                # server + web tests
```

## Support

If you find this project helpful, consider supporting development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/automatebldrs)

## License

[MIT](LICENSE)
