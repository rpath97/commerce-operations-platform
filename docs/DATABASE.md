# Database

PostgreSQL is the system of record. Prisma defines the schema and migrations in `server/prisma/`. This document matches the current `schema.prisma` only.

Money fields use `Decimal(12, 2)`. Users are identified by UUID. There is no Prisma relation from `Order.promotionCode` to `Promotion`; the code on an order is a historical snapshot string.

## Entity relationship diagram

```mermaid
erDiagram
  User ||--o{ Address : has
  User ||--o| Cart : has
  User ||--o{ Order : places
  User ||--o{ AuditLog : may_write
  User ||--o{ InventoryMovement : may_act

  Category ||--o{ Product : contains
  Product ||--o| Inventory : has
  Product ||--o{ CartItem : in_carts
  Product ||--o{ OrderItem : ordered
  Product ||--o{ InventoryMovement : movements

  Cart ||--o{ CartItem : contains

  Order ||--o{ OrderItem : lines
  Order ||--o| OrderShippingAddress : ships_to

  Promotion {
    string code UK
  }

  User {
    uuid id PK
    string email UK
    string passwordHash
    enum role
  }

  Address {
    uuid id PK
    uuid userId FK
  }

  Category {
    uuid id PK
    string slug UK
  }

  Product {
    uuid id PK
    string slug UK
    string sku UK
    decimal price
    boolean isActive
  }

  Inventory {
    uuid id PK
    uuid productId FK
    int quantity
    int lowStockThreshold
  }

  InventoryMovement {
    uuid id PK
    uuid productId FK
    enum type
    int quantityDelta
  }

  Cart {
    uuid id PK
    uuid userId FK
  }

  CartItem {
    uuid id PK
    uuid cartId FK
    uuid productId FK
    int quantity
  }

  Order {
    uuid id PK
    uuid userId FK
    string orderNumber UK
    enum status
    decimal total
    string promotionCode
  }

  OrderItem {
    uuid id PK
    uuid orderId FK
    uuid productId FK
    string productName
    string sku
    decimal unitPrice
  }

  OrderShippingAddress {
    uuid id PK
    uuid orderId FK
  }

  AuditLog {
    uuid id PK
    uuid userId FK
    string action
  }
```

`Promotion` is standalone. Checkout copies a usable code onto `Order.promotionCode`.

## Models

### User

Account identity: email (unique), bcrypt `passwordHash`, name, and `Role` (`CUSTOMER` or `ADMIN`, default `CUSTOMER`). Public registration always inserts `CUSTOMER`. Owns addresses, optional cart, orders, optional audit rows, and optional inventory movement actor links.

### Address

Saved shipping profile for a user. Checkout copies fields onto `OrderShippingAddress`; deleting an address does not rewrite past orders.

### Category

Catalogue grouping: unique `name` and `slug`, optional description. Products cannot delete a category while they still reference it (`onDelete: Restrict`).

### Product

Sellable item: unique `slug` and `sku`, `price`, `isActive` (archive sets this false), description, and `categoryId`. Public catalogue returns active products only.

### Inventory

One row per product (`productId` unique): current `quantity` and `lowStockThreshold`. Quantity is the live stock figure used at add-to-cart and checkout.

### InventoryMovement

Append-only ledger. Types: `INITIAL_STOCK`, `RECEIPT`, `ADJUSTMENT`, `ORDER_PLACED`, `ORDER_CANCELLED`. Stores `quantityDelta`, `quantityBefore`, `quantityAfter`, optional note, optional `referenceType` / `referenceId`, optional `actorUserId`. Product delete cascades movements.

### Cart

One cart per user. Created empty when needed. Checkout clears lines after a successful order.

### CartItem

Line in a cart: unique `(cartId, productId)`, integer `quantity`. Product delete is restricted while a line exists.

### Order

Customer order: unique `orderNumber`, `OrderStatus` (default `PENDING`), `subtotal`, `discountAmount`, `shippingAmount`, `total`, optional `promotionCode`. Totals are operational order value, not payment receipts. User delete is restricted while orders exist.

### OrderItem

Line on an order. Snapshots: `productName`, `sku`, `unitPrice`, `quantity`, `lineTotal`. `productId` is optional and set null if the product is later deleted, so the snapshot remains.

### OrderShippingAddress

One shipping snapshot per order (address fields copied at checkout). Cascades with the order.

### Promotion

Discount definition: unique `code`, `DiscountType` (`PERCENTAGE` or `FIXED_AMOUNT`), `discountValue`, optional `minimumOrderValue`, `startsAt` / `endsAt`, `isActive`. Not linked by foreign key to orders.

### AuditLog

Admin mutation trail: `action`, `entityType`, optional `entityId`, JSON `metadata`, optional `userId` (set null if the user is deleted).
