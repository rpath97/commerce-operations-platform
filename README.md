# CommerceOps

Full-stack e-commerce operations platform: a customer storefront and an internal admin console, backed by a REST API and PostgreSQL.

CommerceOps is a portfolio application that models how a retail operations team would run catalogue, inventory, orders, promotions, and reporting in one product. It is a demonstration storefront. It does not collect payment and is not a live shop.

## Purpose

Retail operations work spans two audiences: customers who browse and place orders, and staff who keep stock, fulfilment, and discounts accurate.

CommerceOps keeps those concerns in one codebase:

- Customers register, browse the catalogue, manage a cart, check out, and track orders.
- Administrators manage products, categories, inventory movements, order status, promotions, and operational analytics.

Money is stored as decimal values, not floating-point. Order lines snapshot product name, SKU, and unit price so history stays accurate after catalogue changes. Order totals are **operational order value**, not collected revenue.

## Key features

### Customer storefront

- Registration, login, and logout
- HTTP-only cookie sessions
- Catalogue, categories, search, filters, sort, and pagination
- Product detail pages
- Authenticated cart with stock-aware quantity updates
- Saved shipping addresses
- Checkout with optional promotion code
- Order history and order detail
- Responsive layout

### Admin / operations

- Role-protected admin console (`ADMIN` only)
- Operations overview (customers, products, orders, low stock)
- Product and category management, including archive/restore
- Cross-customer order list, detail, and controlled status transitions
- Inventory receiving, adjustments, thresholds, and movement history
- Promotion create/edit/enable/disable
- Operational analytics (order activity, status, order value, customers, top products, inventory snapshot)

### Technical highlights

- npm workspaces: React client and Express API
- Prisma schema and migrations against PostgreSQL
- Controller/service separation and Zod request validation
- Serializable checkout transactions with conditional stock decrements
- Append-only inventory movement ledger
- Server-side promotion recalculation (the UI is never trusted for discount math)
- Recharts on the analytics page, with labels so colour is not the only cue
- Production deployment: one Express process serves `/api` and the Vite `client/dist` build on Render, backed by Neon PostgreSQL

### Security highlights

- Passwords hashed with bcrypt
- JWT in an HTTP-only `SameSite=Lax` cookie (`Secure` in production)
- Database role is authoritative; a token claim cannot upgrade a customer
- Helmet headers, 100kb JSON body limit, malformed/oversized body handling
- Login and registration rate limits
- CORS limited to one configured client origin
- Trusted-origin check on unsafe methods when `Origin` is present
- 282 API tests across 18 files, including authorization and JWT failure cases

This is defence-in-depth for a portfolio application, not a claim of production-grade or complete security.

### Testing and CI

- Vitest + Supertest for the API
- Tests run serially against PostgreSQL
- GitHub Actions: Node 20, PostgreSQL service, Prisma migrate deploy, `npm test`, `npm run build`, client lint

Production dependencies currently report **0** vulnerabilities with `npm audit --omit=dev`. Prisma CLI (dev) advisories may still appear in a full `npm audit`.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Recharts |
| Backend | Node.js, Express, TypeScript, Zod, bcrypt, JWT, Helmet, express-rate-limit |
| Data | PostgreSQL, Prisma ORM |
| Testing / CI | Vitest, Supertest, GitHub Actions |

## Architecture

```
Browser (React storefront + admin)
        |
        |  JSON over HTTP, credentialed cookie
        v
Express API  (/api)
        |
        v
PostgreSQL (Prisma)
```

The client talks only to `/api`. In development, Vite proxies that path to the API. Sessions are cookies, not tokens in `localStorage`.

Longer notes: [Architecture](docs/ARCHITECTURE.md), [Database](docs/DATABASE.md), [API](docs/API.md).

## Project structure

```
client/                 React + Vite storefront and admin UI
server/
  src/                  Express routes, controllers, services, middleware
  prisma/               Schema, migrations, seed
  tests/                API tests
docs/                   Architecture, API, database, screenshot notes
.github/workflows/      CI
```

## Screenshots

Portfolio screenshots are not in the repository yet. Capture them locally using [docs/screenshots/README.md](docs/screenshots/README.md), then add the PNG files beside that guide.

## Local setup

### Prerequisites

- Node.js 20 or later
- npm 10 or later
- PostgreSQL 14 or later

Create a database named `commerceops`:

```sql
CREATE DATABASE commerceops;
```

### Install

```bash
npm install
```

### Environment files

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Edit `server/.env` with **your** local values. Placeholders only:

```
NODE_ENV=development
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/commerceops?schema=public"
JWT_SECRET="replace-with-a-long-random-secret-at-least-32-characters"
```

`JWT_SECRET` must be at least 32 characters. Do not commit `server/.env` or any real credentials.

`client/.env` can keep:

```
VITE_API_URL=/api
```

### Database migrations and seed

From the repository root:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```

Seed inserts sample categories and products with inventory. It does not create user accounts.

Optional: `npm run prisma:studio` to inspect data.

To use the admin UI locally, register a customer, then set that user's `role` to `ADMIN` in Prisma Studio. Do not commit credentials.

### Run locally

```bash
npm run dev
```

- Client: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- Database health: [http://localhost:3001/api/health/database](http://localhost:3001/api/health/database)

### npm commands

| Command | Description |
| --- | --- |
| `npm run dev` | Client and API together |
| `npm run dev:client` | Vite only |
| `npm run dev:server` | API with live reload |
| `npm run build` | Production build for both workspaces |
| `npm test` | API tests (282 tests, 18 files) |
| `npm run lint -w client` | Client lint (oxlint) |
| `npm start` | Compiled server (`server/dist`); production also serves `client/dist` |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Apply migrations (development: `prisma migrate dev`) |
| `npm run prisma:migrate:deploy` | Apply migrations (production: `prisma migrate deploy`) |
| `npm run prisma:studio` | Prisma Studio |
| `npm run db:seed` | Seed catalogue sample data |

## API overview

All routes are under `/api`. Details: [docs/API.md](docs/API.md).

| Area | Auth | Notes |
| --- | --- | --- |
| Health | Public | Process and database checks |
| Auth | Mixed | Register/login/logout public; `/me` authenticated |
| Catalogue | Public | Active products only |
| Cart, addresses, orders | Authenticated | Ownership from the session, not the body |
| Promotion preview | Authenticated | `POST /api/promotions/validate` |
| Admin | `ADMIN` | Dashboard, catalogue, inventory, orders, promotions, analytics |

Guest calls to admin routes return `401`. Authenticated customers receive `403`.

## User roles

| Role | How it is created | Access |
| --- | --- | --- |
| `CUSTOMER` | Public registration (always) | Storefront account, cart, checkout, own orders |
| `ADMIN` | Manual role change in the database | All customer access plus `/admin` and `/api/admin` |

Authorization uses the **current database role**. A forged JWT `role` claim cannot grant admin access.

## Known limitations / current scope

Not in this project:

- Real payments (Stripe or otherwise)
- Email verification, password reset, MFA, or OAuth
- Tax calculation, paid shipping, or gift cards
- Product- or category-specific promotions, stacking, or usage caps
- Suppliers, purchase orders, or multi-location inventory
- Cost accounting or inventory valuation
- User administration UI (admin role is assigned in the database)

Demo checkout creates `PENDING` orders with free standard shipping. No payment gateway is connected. Analytics order value is operational, not revenue.

## Development status

| Phase | Status |
| --- | --- |
| 1 Foundation | Complete |
| 2 PostgreSQL / Prisma | Complete |
| 3 Authentication / RBAC | Complete |
| 4 Catalogue API | Complete |
| 5 Storefront UI | Complete |
| 6 Search / filters | Complete |
| 7 Cart | Complete |
| 8 Checkout / orders | Complete |
| 9 Admin dashboard | Complete |
| 10 Inventory | Complete |
| 11 Promotions | Complete |
| 12 Analytics | Complete |
| 13 Testing and security hardening | Complete |
| 14 Portfolio polish | Complete |
| 15 Production deployment | Complete |

## Deployment

**Live demo:** https://commerce-operations-platform.onrender.com

CommerceOps is deployed as a single Render web service serving both the Express API and React/Vite production build, backed by Neon PostgreSQL. Production migrations, process and database health checks, seeded catalogue data, customer registration/login, cart and checkout, order persistence, JSON API fallback behaviour, and admin order access have been verified.

Details: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Licence

Private project for portfolio and interview discussion.
