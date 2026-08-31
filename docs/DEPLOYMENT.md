# Deployment

CommerceOps is prepared for a single-service production deployment. It is **not deployed yet**. There is no public production URL.

This document describes the intended architecture and the steps to host it later. It does not claim a live environment exists.

## Architecture

Production is one Node.js process:

- Express serves the JSON API under `/api`
- The same process serves the Vite production build from `client/dist`
- React Router paths fall back to `index.html`
- Requests under `/api` never fall through to the SPA
- PostgreSQL is a managed database (intended provider: Neon)
- The web service is intended to run on Render

Local development is unchanged: Vite serves the client on port 5173 and proxies `/api` to Express on port 3001.

```mermaid
flowchart LR
  Browser[Browser]
  subgraph render [Render web service]
    Express[Express]
    SPA[client/dist]
    Express --> SPA
  end
  Neon[(Managed PostgreSQL)]

  Browser -->|HTTPS same origin| Express
  Express --> Neon
```

Do not run a second web server in production. Do not put the Vite preview server on the public internet.

## Render web service

Intended shape:

- Runtime: Node.js 20
- Branch: `main`
- Root of the repository as the service root
- Build command equivalent to: install dependencies (including build tools), build client and server, apply production Prisma migrations
- Start command: compiled Express (`npm start`, which runs `node server/dist/index.js` via the server workspace)
- Health check: `GET /api/health`

`render.yaml` in the repository root describes this blueprint. It contains **no secrets**. `DATABASE_URL`, `JWT_SECRET`, and `CLIENT_ORIGIN` are marked `sync: false` so they must be set in the Render dashboard.

Render provides `PORT`. Do not hard-code a production port. The process binds `0.0.0.0` in production so the host can reach it.

`--include=dev` is required during install so TypeScript, Vite, and the Prisma CLI are present for the build. `NODE_ENV=production` is still set for the running process so Secure cookies are enabled.

The database seed is **not** part of build or start. Run `npm run db:seed` only as an explicit, manual initialization when you want sample catalogue data.

## Managed PostgreSQL (Neon)

Prisma is configured for standard PostgreSQL:

```
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

A normal `DATABASE_URL` is enough. There is no Neon-specific client library.

Use the connection string from the provider dashboard. Typical TLS query parameter: `sslmode=require`.

Neon often shows two hosts:

- **Direct** (no `-pooler` in the host): use this for `prisma migrate deploy`
- **Pooled** (host contains `-pooler`): optional for the running app under many concurrent connections

For a first deployment, the direct connection string in `DATABASE_URL` is the simplest working choice. If you later split URLs, keep migrate on the direct host.

Do not commit a real Neon URL.

## Required environment variables

Set these in the Render dashboard (and in Neon, the database URL). Never commit real values.

| Name | Production |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Provided by the host; do not set a local-dev port |
| `DATABASE_URL` | Managed PostgreSQL URL |
| `JWT_SECRET` | Random secret, **at least 32 characters** |
| `CLIENT_ORIGIN` | Public app origin, no trailing slash, for example `https://<your-service-host>` |
| `TRUST_PROXY_HOPS` | Positive integer. Starting placeholder is `1`. Confirm against the actual Render request path during deployment. Never `true`. |

`CLIENT_ORIGIN` must match the public HTTPS origin of the Render service. In production the browser talks to the API on the **same origin**. CORS still allows only this origin (not `*`). The trusted-origin check for unsafe methods also uses this value.

The host creates the public URL when the service is created. Copy that origin into `CLIENT_ORIGIN` before the first successful production boot; the process refuses to start in production if `CLIENT_ORIGIN` is missing.

`VITE_API_URL=/api` stays a relative path so the built client calls the same origin. Do not bake a localhost API URL into the production client build.

## Build process

From the repository root:

```bash
npm ci --include=dev
npm run build
```

`npm run build` runs the Vite production build (`client/dist`) and compiles the server (`server/dist`), including `prisma generate`.

## Production migrations

Use **only**:

```bash
npm run prisma:migrate:deploy
```

That runs the server workspace `prisma migrate deploy` from the repository root. It applies existing migrations. It does **not** run `prisma migrate dev` and does not create new migrations.

Do not modify or add migrations unless the schema actually changes.

`render.yaml` runs `npm run prisma:migrate:deploy` at the end of the build, so `DATABASE_URL` must be available at build time on Render.

## Start process

```bash
npm start
```

This starts `node dist/index.js` in the server workspace. In production the process:

- Listens on `PORT` on `0.0.0.0`
- Sets Express `trust proxy` to `TRUST_PROXY_HOPS` (a positive integer; never `true`)
- Serves `client/dist` for non-API GET/HEAD requests
- Sets the auth cookie `Secure` flag because `NODE_ENV=production`

Do not start Vite in production.

## Health checks

| Path | Purpose |
| --- | --- |
| `GET /api/health` | Process is up. JSON `{ status, service }`. Use this as the Render health check. |
| `GET /api/health/database` | Runs `SELECT 1`. JSON `{ status, database }`. `503` if PostgreSQL is unreachable. |

Both stay under `/api`, so the SPA fallback cannot intercept them. Responses do not include connection strings, secrets, or internal errors.

An unknown `/api/...` path returns JSON `404`, not `index.html`.

## HTTPS and proxy behaviour

Render terminates HTTPS and forwards HTTP to the Node process with `X-Forwarded-*` headers. Traffic may pass through more than one edge or proxy hop; do not treat a hop count of `1` as a verified fact about Render.

In production only, Express sets `trust proxy` to `TRUST_PROXY_HOPS`, a positive integer (default placeholder `1` if unset). That lets:

- `req.secure` / `Secure` cookies work behind TLS termination
- `express-rate-limit` identify clients from `X-Forwarded-For` using the configured hop count

Development and tests do not trust a proxy. The app never sets `trust proxy` to `true` (arbitrary hops).

Confirm `TRUST_PROXY_HOPS` during the real Render deployment by checking Secure cookies and rate-limit behaviour against Render request logs. Do not expose client IPs through a public debug endpoint. If cookies or rate-limit identity are wrong, increase the hop count to match the actual proxy path, then redeploy the env var (no code change).

## Secure cookies

Auth uses cookie `commerceops_token`:

- HttpOnly
- SameSite=Lax
- Path `/`
- `Secure` when `NODE_ENV=production`

Same-origin production (HTTPS app serving both UI and API) is compatible with SameSite=Lax. `CLIENT_ORIGIN` must be the public `https://` origin so CORS and trusted-origin checks match the browser.

## First deployment checklist

The application is not live until these steps succeed on real hosts. Do not treat this list as a completed deploy.

1. Create a Neon PostgreSQL database. Copy the connection string; do not commit it.
2. Create a Render web service from this repository, branch `main`, Node 20, root directory `.`
3. In Render, set `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (32+ random characters), `CLIENT_ORIGIN` to the public HTTPS origin Render assigned (no trailing slash), and `TRUST_PROXY_HOPS` to a positive integer. Start with `1` only as a placeholder and verify it against the actual Render request path.
4. Confirm `PORT` is provided by Render and not overridden with `3001`.
5. Deploy. Build should install, compile client and server, and run `prisma migrate deploy`. Start should run `npm start`.
6. Confirm `GET /api/health` returns JSON `200`.
7. Confirm `GET /api/health/database` returns JSON `200` with `database: connected`.
8. Confirm `GET /` returns the React application (HTML).
9. Confirm a client route such as `/shop` returns the React application.
10. Confirm `GET /api/unknown` returns JSON `404`, not HTML.
11. Register a user over HTTPS and confirm the session cookie is `Secure`.
12. Optionally, **once**, run `npm run db:seed` against production if you want the sample catalogue. This is not part of deploy.

## Rollback and troubleshooting

- **Failed migrate:** The build stops before start. Fix the database URL (prefer the Neon **direct** host for migrate) or restore a previous release; do not run `prisma migrate dev` against production.
- **Health check failing:** Check `GET /api/health`. If that works but the site is HTML 404s, the client build may be missing (`client/dist` not produced).
- **Database health 503:** `DATABASE_URL`, Neon allow-list / network, or `sslmode`. The health payload will not include the URL.
- **Cookies not set / login loops:** `NODE_ENV` must be `production`, `CLIENT_ORIGIN` must be the exact public origin (`https://...`, no trailing slash), and `TRUST_PROXY_HOPS` must match the actual proxy path (never `true`).
- **CORS or 403 Forbidden on POST:** `CLIENT_ORIGIN` does not match the browser origin. Do not set CORS to `*`.
- **Rate-limit / wrong client IP:** Confirm `TRUST_PROXY_HOPS` against Render request logs. Do not set `trust proxy` to `true`, and do not add a public IP debug route.
- **Rollback:** Redeploy the previous Render release. Prisma migrations already applied stay applied; restoring schema requires a forward fix or a restored database. This app does not auto-seed, so a rollback does not re-insert sample data.

## Manual seed (optional)

```bash
npm run db:seed
```

Use this only when you intentionally want sample categories and products. It is not a deploy step and must not be wired into `render.yaml` start or build.
