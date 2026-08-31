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
- Product and category management
- Order management and status updates
- Low-stock count on the operations overview
- Inventory receiving, adjustments, thresholds, and movement history
- Customer management (later)
- Promotion and discount management (later)
- Revenue, order, and inventory statistics (later)

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

**Phase 5 – customer storefront UI (complete)**

- React storefront layout with header, footer, and mobile navigation
- Home page with categories and latest products
- Catalogue at `/shop` with category URL filters, sort, search, and pagination
- Categories page and product detail pages
- Responsive product grid and placeholder product visuals
- Public catalogue API integration (`VITE_API_URL`)
- Header shows first name when an HTTP-only session cookie is present

**Phase 6 – catalogue search and filters (complete)**

- Full catalogue search from `/shop`
- Category, price range, and stock availability filters
- Sorting with URL-backed catalogue state
- Active filter chips and a responsive filter panel

**Phase 7 – shopping cart (complete)**

- Authenticated cart API (`GET/DELETE /api/cart`, add/update/remove items)
- Stock-aware add and quantity updates without reserving or decrementing inventory
- Server-calculated line totals and subtotal as 2-decimal strings
- Storefront login, register, and logout using the existing HTTP-only JWT cookie
- Add to cart from product cards and product detail
- Cart page with quantity controls, remove, clear, empty and guest states
- Header cart count (total units)
- Responsive cart layout

**Phase 8 – checkout and orders (complete)**

- Saved customer shipping addresses
- Checkout from the cart with stock revalidation
- Transactional order creation and atomic inventory decrement
- Product and shipping-address snapshots on each order
- Customer order history and order detail
- Demo orders are created as `PENDING` with free standard shipping
- No payment gateway is connected; this storefront does not collect payment

**Phase 9 – admin dashboard (complete)**

- Role-protected admin console at `/admin` (`ADMIN` only)
- Operational overview counts (customers, products, categories, orders, low stock)
- Product create, edit, archive, and restore
- Category create, edit, and delete (blocked while products remain)
- Cross-customer order list and order detail
- Controlled order status transitions
- Transactional cancellation that restocks product-linked items once
- Admin mutation audit logging (`AuditLog`)

**Phase 10 – inventory management (complete)**

- Admin inventory overview with healthy, low-stock, and out-of-stock states
- Stock receiving and positive/negative manual adjustments
- Low-stock threshold updates
- Immutable inventory movement history
- `ORDER_PLACED` movements from checkout and `ORDER_CANCELLED` restock movements
- `INITIAL_STOCK` movements when a product is created with stock
- Transactional, concurrency-safe stock mutations
- Admin audit logging for manual inventory operations

Not implemented yet:

- Real payments (Stripe or otherwise)
- Suppliers, purchase orders, or multi-location inventory
- Inventory valuation or cost accounting
- Promotions and discount codes
- Analytics charts or revenue reporting
- User and role administration
- Production deployment

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

### Cart

All cart routes require an authenticated session. The user is taken from the cookie, not from the request body. Carts do not reserve stock; checkout must revalidate inventory later.

Prices and totals are decimal strings with two places. `itemCount` is the sum of quantities.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/cart` | Authenticated | Current cart (created empty if needed) |
| `POST` | `/api/cart/items` | Authenticated | Add a product or increment an existing line |
| `PATCH` | `/api/cart/items/:itemId` | Authenticated | Set quantity (`>= 1`) |
| `DELETE` | `/api/cart/items/:itemId` | Authenticated | Remove one line |
| `DELETE` | `/api/cart` | Authenticated | Clear all lines |

Inactive or out-of-stock catalogue changes still appear on `GET` with current availability. Add and quantity updates return `409` when the product cannot be purchased.

### Addresses

All address routes require an authenticated session. The user is taken from the cookie. Deleting a saved address does not change historical orders.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/addresses` | Authenticated | List the current user's addresses |
| `POST` | `/api/addresses` | Authenticated | Create an address |
| `PATCH` | `/api/addresses/:addressId` | Authenticated | Update an owned address |
| `DELETE` | `/api/addresses/:addressId` | Authenticated | Delete an owned address |

### Orders

Checkout creates a `PENDING` order from the current cart. Prices, totals, product names, SKUs, and the shipping address are snapshotted server-side. Inventory is decremented only if the whole transaction succeeds. Standard shipping is free in this demonstration (`shippingAmount` `0.00`). Discount is `0.00` until promotions exist. No payment is collected.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/orders` | Authenticated | Create an order from the cart (`{ "addressId" }`) |
| `GET` | `/api/orders` | Authenticated | Paginated order history (`page`, `limit`) |
| `GET` | `/api/orders/:orderId` | Authenticated | Order detail for the current user |

`POST /api/orders` uses a serializable transaction, conditional stock decrements, and rolls back on any purchasing conflict.

### Admin

All `/api/admin` routes require an authenticated `ADMIN` session. Guests receive `401`. Authenticated customers receive `403`. Public registration cannot create an `ADMIN` account.

The admin console UI is at `/admin`. It is a convenience; the API is the authorization boundary.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard` | Operational counts and the five most recent orders |
| `GET` | `/api/admin/categories` | Categories with product counts (including archived products) |
| `POST` | `/api/admin/categories` | Create a category |
| `PATCH` | `/api/admin/categories/:id` | Update a category |
| `DELETE` | `/api/admin/categories/:id` | Delete an empty category (`409` if products remain) |
| `GET` | `/api/admin/products` | Paginated admin product list (active and archived) |
| `GET` | `/api/admin/products/:id` | Admin product detail |
| `POST` | `/api/admin/products` | Create a product and initial inventory together |
| `PATCH` | `/api/admin/products/:id` | Update catalogue fields or restore (`isActive: true`) |
| `PATCH` | `/api/admin/products/:id/inventory` | Legacy absolute inventory update (writes an `ADJUSTMENT` movement when quantity changes) |
| `DELETE` | `/api/admin/products/:id` | Archive a product (`isActive = false`) |
| `GET` | `/api/admin/inventory` | Paginated inventory overview |
| `GET` | `/api/admin/inventory/:productId` | Inventory detail and recent movements |
| `POST` | `/api/admin/inventory/:productId/receive` | Receive stock |
| `POST` | `/api/admin/inventory/:productId/adjust` | Manual positive or negative adjustment |
| `PATCH` | `/api/admin/inventory/:productId/settings` | Update low-stock threshold |
| `GET` | `/api/admin/inventory/:productId/movements` | Immutable movement history |
| `GET` | `/api/admin/orders` | Paginated orders across all customers |
| `GET` | `/api/admin/orders/:orderId` | Order detail for any customer |
| `PATCH` | `/api/admin/orders/:orderId/status` | Apply an allowed status transition |

`GET /api/admin/products` supports `page`, `limit` (default 20, max 100), `search`, `category` (slug), `status` (`all`, `active`, `archived`), and `sort` (`newest`, `name-asc`, `name-desc`, `price-asc`, `price-desc`).

`GET /api/admin/orders` supports `page`, `limit` (default 20, max 50), `search` (order number, customer email, first name, last name), and `status`.

Allowed status transitions:

- `PENDING` → `PROCESSING` or `CANCELLED`
- `PAID` → `PROCESSING` or `CANCELLED`
- `PROCESSING` → `SHIPPED` or `CANCELLED`
- `SHIPPED` → `DELIVERED`
- `DELIVERED` and `CANCELLED` are terminal

There is no admin action for `PENDING` → `PAID`. This project has no payment gateway. Invalid transitions return `409`. Cancelling an order restocks `OrderItem.quantity` for lines that still have a `productId`, once, in the same transaction as the status change, `ORDER_CANCELLED` movement, and audit log.

Inventory is single-location. Current quantity stays on `Inventory`. `InventoryMovement` is an append-only ledger for Phase 10 onward. Existing stock is not backfilled with invented history. Checkout writes `ORDER_PLACED` movements in the same serializable transaction as the stock decrement. Manual receive/adjust operations are admin-only and cannot set stock below zero.

To use the admin UI locally, register a customer account as usual, then set that user's `role` to `ADMIN` in Prisma Studio. Do not commit local credentials.

## Licence

Private project for portfolio and interview discussion.
