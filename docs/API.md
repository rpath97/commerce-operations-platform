# API

JSON API mounted at `/api`. Inspected from `server/src/routes/`. Money in responses is a 2-decimal string. The JWT is never returned in JSON.

Error shape:

```json
{ "error": { "message": "…" } }
```

Validation failures may include Zod `details`. Unknown failures are `500` with `Internal server error`.

## Health

**Auth:** public.

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/health` | `{ status, service }` |
| `GET` | `/api/health/database` | `{ status, database }`; `503` if PostgreSQL is unreachable |

## Authentication

**Auth:** register, login, and logout are public. `GET /me` requires a valid session.

Login and register are rate-limited. Successful attempts are not counted.

| Method | Path | Behaviour |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Body: `firstName`, `lastName`, `email`, `password`. Always `CUSTOMER`. `201` + cookie. Extra fields (including `role`) → `400` |
| `POST` | `/api/auth/login` | Body: `email`, `password`. Generic `401` for unknown email or wrong password |
| `POST` | `/api/auth/logout` | Clears the session cookie |
| `GET` | `/api/auth/me` | Current public user fields |

Cookie: `commerceops_token`, HttpOnly, SameSite=Lax, Path=/, Max-Age 7 days, Secure when `NODE_ENV=production`.

## Catalogue

**Auth:** public. Only active products.

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/categories` | Category list |
| `GET` | `/api/categories/:slug` | One category; `404` if missing |
| `GET` | `/api/products` | Paginated search. Query: `page`, `limit` (max 100), `search`, `category` (slug), `minPrice`, `maxPrice`, `inStock`, `sort` |
| `GET` | `/api/products/:slug` | Active product; inventory is `quantity` and `inStock` only |

## Addresses

**Auth:** authenticated. Scoped to `req.auth`.

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/addresses` | Current user’s addresses |
| `POST` | `/api/addresses` | Create |
| `PATCH` | `/api/addresses/:addressId` | Update owned address; unknown or other user’s id → `404` |
| `DELETE` | `/api/addresses/:addressId` | Delete owned address |

`userId` in the body is rejected (strict schema).

## Cart

**Auth:** authenticated. Cart identity comes from the session.

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/cart` | Cart (created empty if needed). Line totals and subtotal are server-calculated |
| `POST` | `/api/cart/items` | Add or increment; `409` if the product cannot be purchased |
| `PATCH` | `/api/cart/items/:itemId` | Set quantity (≥ 1) |
| `DELETE` | `/api/cart/items/:itemId` | Remove one line |
| `DELETE` | `/api/cart` | Clear |

Cart does not reserve stock.

## Checkout / orders

**Auth:** authenticated. Customer sees only their orders.

| Method | Path | Behaviour |
| --- | --- | --- |
| `POST` | `/api/orders` | Body: `{ addressId, promotionCode? }`. Creates `PENDING` order, snapshots lines and shipping, decrements stock, optional discount. Computed money/status in the body → `400` |
| `GET` | `/api/orders` | Paginated history (`page`, `limit` max 50) |
| `GET` | `/api/orders/:orderId` | Detail; other customer’s order → `404` |

Shipping amount is `0.00` in this demonstration. No payment is collected.

## Promotions (customer preview)

**Auth:** authenticated.

| Method | Path | Behaviour |
| --- | --- | --- |
| `POST` | `/api/promotions/validate` | Body `{ code }`. Previews discount against the current cart. Does not mutate cart or create an order |

Checkout re-runs the same rules inside the transaction.

## Admin operations

**Auth:** authenticated. **Role:** `ADMIN`. Guest `401`, customer `403`.

### Dashboard

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard` | Counts plus five most recent orders |

### Categories

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/admin/categories` | Categories with product counts (including archived products) |
| `POST` | `/api/admin/categories` | Create |
| `PATCH` | `/api/admin/categories/:id` | Update |
| `DELETE` | `/api/admin/categories/:id` | Delete; `409` if products remain |

### Products

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/admin/products` | Paginated admin list (`search`, `category`, `status`, `sort`) |
| `GET` | `/api/admin/products/:id` | Detail |
| `POST` | `/api/admin/products` | Create product and inventory together |
| `PATCH` | `/api/admin/products/:id` | Update catalogue fields or restore (`isActive: true`) |
| `PATCH` | `/api/admin/products/:id/inventory` | Legacy absolute quantity update (writes `ADJUSTMENT` when quantity changes) |
| `DELETE` | `/api/admin/products/:id` | Archive (`isActive = false`) |

## Inventory

**Auth:** `ADMIN`.

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/admin/inventory` | Paginated overview and summary |
| `GET` | `/api/admin/inventory/:productId` | Detail and recent movements |
| `GET` | `/api/admin/inventory/:productId/movements` | Full movement history (paginated) |
| `POST` | `/api/admin/inventory/:productId/receive` | Receive stock |
| `POST` | `/api/admin/inventory/:productId/adjust` | Manual +/- adjustment |
| `PATCH` | `/api/admin/inventory/:productId/settings` | Low-stock threshold |

Manual operations cannot set quantity below zero. Mutations write `InventoryMovement` and audit rows.

### Admin orders

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/admin/orders` | All customers; `search`, `status`, pagination |
| `GET` | `/api/admin/orders/:orderId` | Any customer’s order |
| `PATCH` | `/api/admin/orders/:orderId/status` | Allowed transitions only; `409` otherwise. Cancel restocks product-linked lines once |

Allowed transitions:

- `PENDING` → `PROCESSING` or `CANCELLED`
- `PAID` → `PROCESSING` or `CANCELLED`
- `PROCESSING` → `SHIPPED` or `CANCELLED`
- `SHIPPED` → `DELIVERED`
- `DELIVERED` and `CANCELLED` are terminal

There is no admin action for `PENDING` → `PAID` (no payment gateway).

## Promotions (admin)

**Auth:** `ADMIN`.

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/admin/promotions` | Paginated list; derived status filters |
| `GET` | `/api/admin/promotions/:promotionId` | Detail |
| `POST` | `/api/admin/promotions` | Create |
| `PATCH` | `/api/admin/promotions/:promotionId` | Update, including enable/disable |

No hard-delete. Disable with `isActive: false`. Audit actions such as `PROMOTION_CREATED` are written in the same transaction.

## Analytics

**Auth:** `ADMIN`.

| Method | Path | Behaviour |
| --- | --- | --- |
| `GET` | `/api/admin/analytics` | Query `range`: `7d`, `30d` (default), `90d`, `all` |

Returns summary metrics, daily series, status distribution, top products, promotion usage, and a current inventory snapshot. Order values are operational totals, not revenue. Invalid `range` → `400`.
