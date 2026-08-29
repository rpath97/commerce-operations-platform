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

### Planned data model

User, Address, Category, Product, Inventory, Cart, CartItem, Order, OrderItem, Promotion, AuditLog

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Recharts |
| Backend | Node.js, Express, TypeScript, Zod, bcrypt, JWT (HTTP-only cookies) |
| Data | PostgreSQL, Prisma ORM |
| Testing | Vitest, Supertest |

## Repository layout

```
client/    React + Vite application (storefront and dashboard UI)
server/    Express REST API
```

The repository uses npm workspaces so both packages can be installed and scripted from the root.

## Current development status

**Phase 1 – project foundation (complete)**

Completed in this phase:

- Monorepo-style `client` and `server` packages
- React + TypeScript + Vite client with Tailwind CSS
- Express + TypeScript API with controller/service separation
- Central error handling and a health check route
- Environment variable examples
- Root development scripts

Not implemented yet:

- Authentication and authorisation
- Database, Prisma schema, and migrations
- Catalogue, cart, checkout, and orders
- Admin dashboard and statistics

## Getting started

### Prerequisites

- Node.js 20 or later
- npm 10 or later

PostgreSQL is not required until the data layer is introduced.

### Install

```bash
npm install
```

### Environment files

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

### Run locally

```bash
npm run dev
```

- Client: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:3001/api/health](http://localhost:3001/api/health)

In development, Vite proxies `/api` to the Express server.

### Other scripts

| Command | Description |
| --- | --- |
| `npm run dev:client` | Start the Vite dev server only |
| `npm run dev:server` | Start the API with live reload |
| `npm run build` | Production build for client and server |
| `npm test` | Run API tests |
| `npm start` | Run the compiled API (`server/dist`) |

## API

### `GET /api/health`

```json
{
  "status": "ok",
  "service": "CommerceOps API"
}
```

## Licence

Private project for portfolio and interview discussion.
