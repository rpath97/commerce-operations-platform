# Architecture

Vendora is a two-package npm workspace: a React SPA and an Express JSON API sharing one PostgreSQL database.

## High-level system

```mermaid
flowchart LR
  subgraph client [Browser]
    Storefront[Storefront UI]
    AdminUI[Admin console]
  end

  subgraph server [API process]
    Express[Express /api]
    MW[Auth, RBAC, validation, security middleware]
    Services[Domain services]
    SPA[client/dist in production]
  end

  DB[(PostgreSQL via Prisma)]

  Storefront -->|credentialed JSON| Express
  AdminUI -->|credentialed JSON| Express
  Express --> MW --> Services --> DB
  Express --> SPA
```

In local development, Vite serves the client and proxies `/api` to Express. In production, the same Express process serves the Vite build from `client/dist` and keeps `/api` on the same origin. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Frontend responsibilities

The `client/` app:

- Renders the storefront and `/admin` console
- Calls `/api` with Axios (`withCredentials: true`)
- Keeps session state from `GET /api/auth/me` (cookie is HTTP-only; JavaScript never stores the JWT)
- Formats money as display strings; it does not compute checkout totals as a source of truth
- Uses Recharts on analytics; ranked lists remain visible without relying on colour alone

## Backend / API responsibilities

The `server/` app:

- Exposes REST routes under `/api`
- Validates bodies, query strings, and params with Zod (`.strict()` where used)
- Authenticates via the `commerceops_token` cookie
- Authorizes with the **database** user role
- Runs checkout and stock mutations in Prisma transactions
- Returns public DTOs (no `passwordHash`, no JWT in JSON)

## PostgreSQL / Prisma responsibilities

Prisma owns schema, migrations, and typed access. Money uses `Decimal(12, 2)`. Historical order rows snapshot catalogue and address data so later product edits do not rewrite completed orders.

See [DATABASE.md](DATABASE.md).

## Authentication flow

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as API
  participant D as PostgreSQL

  B->>A: POST /api/auth/login
  A->>D: Lookup user by email
  A->>A: bcrypt compare (dummy hash if no user)
  alt credentials valid
    A->>A: Sign JWT (HS256, issuer, audience, 7d)
    A->>B: Set-Cookie HttpOnly SameSite=Lax
    A->>B: JSON user profile
  else invalid
    A->>B: 401 Invalid email or password
  end

  B->>A: GET /api/auth/me (cookie)
  A->>A: Verify JWT
  A->>D: Load user by token userId
  A->>B: Current user or 401
```

Logout clears the cookie with the same Path / HttpOnly / SameSite / Secure attributes used when it was set.

## Authorization / RBAC flow

```mermaid
flowchart TD
  Req[Incoming request] --> Cookie{Cookie present and valid?}
  Cookie -->|no| Unauth[401 Authentication required]
  Cookie -->|yes| DB[Load User from database]
  DB -->|missing| Unauth
  DB -->|found| Role{req.auth.role}
  Role -->|CUSTOMER on /api/admin| Forbid[403 Insufficient permissions]
  Role -->|ADMIN on /api/admin| AllowAdmin[Admin handler]
  Role -->|any authenticated on cart/orders| Own[Scope queries to req.auth.id]
```

The JWT may include a `role` claim for convenience. Middleware does **not** trust it for privileges. `requireRole` reads `req.auth.role` from Prisma.

Customers cannot pass `userId` / `customerId` to act as someone else. Address, cart, and customer order queries are scoped to the session user.

## Checkout transaction flow

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as Order service
  participant D as PostgreSQL

  B->>A: POST /api/orders { addressId, promotionCode? }
  A->>D: Serializable transaction
  A->>D: Load cart lines and owned address
  A->>D: Re-read product price and inventory
  opt promotion code present
    A->>D: Load promotion and recompute discount
  end
  A->>D: Conditional decrement stock
  A->>D: Insert Order, OrderItems, shipping snapshot
  A->>D: InventoryMovement ORDER_PLACED
  A->>D: Clear cart
  A->>B: Order DTO (PENDING, operational totals)
```

Client-supplied `total`, `subtotal`, `discountAmount`, `status`, and similar fields are rejected by the create-order schema. Shipping in this demonstration is `0.00`. Status is `PENDING`. No payment is captured.

## Inventory movement flow

Current quantity lives on `Inventory`. `InventoryMovement` is append-only.

| Type | Typical source |
| --- | --- |
| `INITIAL_STOCK` | Product created with opening quantity |
| `RECEIPT` | Admin receive |
| `ADJUSTMENT` | Admin manual adjust (or legacy absolute inventory patch) |
| `ORDER_PLACED` | Checkout decrement |
| `ORDER_CANCELLED` | Admin cancel restock (once, product-linked lines) |

Admin receive/adjust cannot take stock below zero. Checkout decrements only if the whole transaction succeeds.

## Promotion flow

1. Admin creates a code (percentage or fixed amount, window, optional minimum merchandise subtotal).
2. Customer may preview with `POST /api/promotions/validate` against the **current** cart.
3. Checkout revalidates the same rules inside the order transaction.
4. The order stores `promotionCode` and `discountAmount` as snapshots. Later promotion edits do not change historical orders.

Codes are normalised (trim, uppercase). One code per order. No stacking.

## Analytics flow

`GET /api/admin/analytics?range=7d|30d|90d|all` (default `30d`) aggregates existing order, user, and inventory rows. Rolling ranges use UTC calendar days. Cancelled orders count toward activity and status, not toward non-cancelled order value, units, top products, or promotion usage. Inventory figures are a **current** snapshot, not ranged. Results are aggregates; customer identities are not listed.

## CI flow

```mermaid
flowchart TD
  Push[Push or pull request] --> GHA[GitHub Actions]
  GHA --> Node[Node 20 + npm ci]
  Node --> PG[PostgreSQL service]
  PG --> Migrate[prisma migrate deploy]
  Migrate --> Test[npm test]
  Test --> Build[npm run build]
  Build --> Lint[client oxlint]
```

CI uses a throwaway database and a placeholder JWT. It does not use production secrets.

## Security boundaries

- Browser never receives the JWT in JSON and cannot read the HTTP-only cookie
- CORS allows a single `CLIENT_ORIGIN` with credentials (not `*`)
- Helmet sets standard security headers; CSP is off so the Vite production bundle can load
- JSON bodies limited to 100kb; malformed JSON is `400`; oversized is `413`
- Login/register rate limits (in-memory, per process)
- Unsafe methods with an explicit foreign `Origin` are `403` (defence-in-depth with SameSite cookies; not a complete CSRF product)
- `trust proxy` is unset in development and tests. In production it is the positive integer `TRUST_PROXY_HOPS` (never `true`). Verify the hop count against the actual host request path; do not assume a fixed proxy topology.
