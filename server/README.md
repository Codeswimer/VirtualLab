# Virtual Lab API

A small, dependency-free Node server that owns authentication, schools, accounts,
approvals, attempts and teacher marks. It uses the SQLite driver built into
Node 24 (`node:sqlite`) and can serve the built frontend from the same origin.

## Run it

Development (API on `:4000`, Vite on `:5173` with `/api` proxied):

```bash
pnpm install
pnpm dev
```

Production:

```bash
pnpm build
PORT=4000 DATA_DIR=/var/lib/vlab pnpm start
```

Open `http://localhost:4000`. The first start creates the database and seeds the
demo school network. To start with an empty platform instead, create the
database and remove the demo rows, or point `DB_PATH` at a new file and seed
your own schools through the owner console.

Useful commands:

```bash
pnpm test:api     # API integration tests (no external database needed)
pnpm seed:reset   # delete server/data/vlab.db; restart to reseed the demo
```

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port served by `server/index.mjs` |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `server/data` | Directory for the SQLite file |
| `DB_PATH` | `$DATA_DIR/vlab.db` | Explicit database path |
| `CORS_ORIGIN` | none | Comma-separated extra origins if the web app is hosted separately |
| `VITE_API_BASE_URL` | same origin | Frontend build-time API base, only needed for a split deployment |

Passwords are hashed with scrypt and sessions are opaque bearer tokens stored
in the `sessions` table. Put the server behind HTTPS; the browser keeps the
session token in local storage.

## API surface

```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/register-school
POST /api/auth/logout
GET  /api/bootstrap
PATCH /api/schools/:id/status          owner only
POST /api/schools/:id/members          school admin / owner
PATCH /api/members/:id/status          school admin / owner
PUT  /api/attempts/:id                 student draft upsert
POST /api/attempts/:id/submit          student submission
DELETE /api/attempts/:id               discard a draft
PATCH /api/attempts/:id/review         teacher / owner mark
DELETE /api/attempts/:id/review        remove a teacher mark
```

`GET /api/bootstrap` is role-scoped: students receive only their own account and
attempts; teachers receive their class; school admins their school; the owner
receives the network. Every role also receives sanitised leaderboard rows with
class, school and global ranks.

## Operational notes

- SQLite runs in WAL mode. Back up the database once per term with
  `sqlite3 vlab.db ".backup backup.db"` or copy the file while the server is stopped.
- The API is single-instance. For a multi-instance deployment, replace SQLite
  with PostgreSQL and move sessions to a shared store.
- Automatic rubric scoring is still computed in the browser by the shared
  `sim-core` marking service, then stored with the submission. Teacher marks are
  authoritative and replace the automatic score on reports and leaderboards.
