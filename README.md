# CommerceOps

Full-stack e-commerce operations platform for a growing retail business.

CommerceOps is designed as a commercial-style product rather than a tutorial demo. It will eventually support a customer storefront and an internal operations dashboard, with a REST API, relational data, and role-based access.

## Purpose

Simulate how a junior/mid-level engineering team would structure a real operations product:

- Customers browse a catalogue, manage a cart, check out, and track orders.
- Operations staff manage catalogue, inventory, customers, orders, promotions, and reporting.

## Planned features

### Customer storefront

- Registration, login, and logout
- Secure session authentication
- Product catalogue, categories, search, and filtering
- Product detail pages
- Shopping cart and quantity updates
- Promotional codes
- Checkout and saved addresses
- Order creation, history, and tracking
- Responsive mobile layout

### Admin operations dashboard

- Role-based admin authentication
- Product, category, and inventory management
- Low-stock warnings
- Customer management
- Order management and status updates
- Promotion and discount management
- Revenue, order, and inventory statistics

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Recharts |
| Backend | Node.js, Express, TypeScript, Zod, bcrypt, JWT (HTTP-only cookies) |
| Data | PostgreSQL, Prisma ORM |
| Testing | Vitest, Supertest |

## Architecture

```
client/                 React + Vite application (storefront and dashboard UI)
server/
  src/                  Express REST API (routes, controllers, services)
  prisma/               Schema, migrations, and seed data
```

The repository uses npm workspaces so both packages can be installed and scripted from the root.

The API talks to PostgreSQL through a shared Prisma client (`server/src/lib/prisma.ts`). Money is stored as `Decimal`, not floating-point. Order line items keep product name, SKU, and unit price snapshots so historical orders stay accurate after catalogue changes.

Authentication uses bcrypt password hashes and a JWT stored in an HTTP-only cookie. Public registration always creates a `CUSTOMER` account. `ADMIN` access is enforced with role middleware on protected routes.

## Current development status

**Phase 1 – project foundation (complete)**

- Monorepo-style `client` and `server` packages
- React + TypeScript + Vite client with Tailwind CSS
- Express + TypeScript API with controller/service separation
- Central error handling and `GET /api/health`

**Phase 2 – PostgreSQL + Prisma foundation (complete)**

- Prisma schema for User, Address, Category, Product, Inventory, Cart, CartItem, Order, OrderItem, Promotion, and AuditLog
- Initial migration
- Catalogue seed data (no user accounts)
- `GET /api/health/database`

**Phase 3 – authentication and role-based access (complete)**

- Customer registration and login
- Passwords hashed with bcrypt
- JWT session in an HTTP-only cookie
- `GET /api/auth/me` and logout
- `CUSTOMER` / `ADMIN` role middleware

**Phase 4 – catalogue API (complete)**

- Public category and product listing
- Search, filters, sorting, and pagination
- Admin category and product management
- Product + inventory created in one transaction
- Soft product archive (`isActive = false`)

Not implemented yet:

- Cart, checkout, and order APIs
- Admin dashboard and statistics
- Storefront catalogue, login, and register pages

## Getting started

### Prerequisites

- Node.js 20 or later
- npm 10 or later
- PostgreSQL 14 or later, with a database named `commerceops`

Create the database once:

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

In `server/.env`, set `DATABASE_URL` to your local PostgreSQL connection string:

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/commerceops?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
```

Do not commit `server/.env`.

### Database migrations and seed

From the repository root:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```

`prisma:migrate` applies the initial schema. `db:seed` inserts three categories (Electronics, Fitness, Home & Lifestyle) and six sample products with inventory. It does not create users or passwords.

Inspect data in Prisma Studio:

```bash
npm run prisma:studio
```

### Run locally

```bash
npm run dev
```

- Client: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- Database health: [http://localhost:3001/api/health/database](http://localhost:3001/api/health/database)

In development, Vite proxies `/api` to the Express server.

### Other scripts

| Command | Description |
| --- | --- |
| `npm run dev:client` | Start the Vite dev server only |
| `npm run dev:server` | Start the API with live reload |
| `npm run build` | Production build for client and server |
| `npm test` | Run API tests |
| `npm start` | Run the compiled API (`server/dist`) |
| `npm run prisma:generate` | Generate the Prisma Client |
| `npm run prisma:migrate` | Run Prisma migrations in development |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed catalogue sample data |

## API

### `GET /api/health`

```json
{
  "status": "ok",
  "service": "CommerceOps API"
}
```

### `GET /api/health/database`

```json
{
  "status": "ok",
  "database": "connected"
}
```

Returns HTTP 503 with `"database": "disconnected"` if PostgreSQL is unavailable.

### Authentication

Sessions are issued as a JWT in an HTTP-only cookie (`commerceops_token`). The token payload contains only `userId` and `role`. The JSON body never includes the token or `passwordHash`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Create a `CUSTOMER` account and start a session |
| `POST` | `/api/auth/login` | Public | Authenticate and start a session |
| `POST` | `/api/auth/logout` | Public | Clear the session cookie |
| `GET` | `/api/auth/me` | Authenticated | Return the current user |

Invalid login attempts return the same `401` message whether the email is unknown or the password is wrong.

### Catalogue

Public catalogue endpoints return only active products. Prices are decimal strings. Inventory is limited to `quantity` and `inStock`.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/categories` | Public | List categories |
| `GET` | `/api/categories/:slug` | Public | Get a category |
| `GET` | `/api/products` | Public | Paginated product search and filters |
| `GET` | `/api/products/:slug` | Public | Get an active product |

`GET /api/products` supports `page`, `limit` (max 100), `search`, `category` (slug), `minPrice`, `maxPrice`, `inStock`, and `sort` (`newest`, `price-asc`, `price-desc`, `name-asc`, `name-desc`).

### Admin catalogue

All `/api/admin` routes require an authenticated `ADMIN` session.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/admin/categories` | Create a category |
| `PATCH` | `/api/admin/categories/:id` | Update a category |
| `DELETE` | `/api/admin/categories/:id` | Delete an empty category (`409` if products remain) |
| `POST` | `/api/admin/products` | Create a product and inventory together |
| `PATCH` | `/api/admin/products/:id` | Update product fields |
| `PATCH` | `/api/admin/products/:id/inventory` | Update stock levels |
| `DELETE` | `/api/admin/products/:id` | Archive a product (`isActive = false`) |

## Licence

Private project for portfolio and interview discussion.
