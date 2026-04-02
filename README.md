# InvenTrack — Smart Inventory & Order Management System

A full-stack web application for managing products, stock levels, customer orders, and fulfillment workflows with real-time validation, conflict handling, and role-based access control.

**Live Stack:** Next.js 16 + Express.js 5 + PostgreSQL 15 + Redis 7 — fully containerized with Docker.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Frontend Pages](#frontend-pages)
- [Authentication & Authorization](#authentication--authorization)
- [Business Logic](#business-logic)
- [Race Condition Handling](#race-condition-handling)
- [Redis Caching](#redis-caching)
- [Docker Setup](#docker-setup)
- [Local Development](#local-development)
- [Seed Data](#seed-data)
- [Environment Variables](#environment-variables)

---

## Features

### Core Modules

| Module | Capabilities |
|--------|-------------|
| **Authentication** | Email/password signup & login, JWT access/refresh tokens, demo login (User + Admin), session management |
| **Categories** | CRUD operations, product count tracking, search, pagination |
| **Products** | CRUD with SKU, price, stock, min threshold, auto status (Active/Out of Stock), category linking |
| **Orders** | Create with multiple items, auto-calculated totals, status workflow (Pending→Confirmed→Shipped→Delivered), cancel with stock restoration |
| **Stock Handling** | Auto-deduct on order, insufficient stock warnings, auto Out of Stock when stock=0, stock restoration on cancel |
| **Restock Queue** | Auto-populated when stock drops below threshold, priority levels (High/Medium/Low), manual restock action |
| **Dashboard** | 8 KPI cards, 4 charts (Pending vs Completed butterfly, Revenue area, Orders by Status bar, Stock Health donut), product stock table, recent orders, activity feed |
| **Activity Log** | Tracks all system actions with user attribution, entity type filtering, server-side pagination |
| **User Management** | Admin-only: list users, promote/demote roles, activate/deactivate, delete users |

### Conflict Detection

- Duplicate product entries in same order blocked (client + server + DB unique constraint)
- Inactive/out-of-stock products cannot be ordered
- Inline stock warning when requested quantity exceeds available stock
- Create Order button disabled until all validations pass

### Role-Based Access

| Feature | USER | ADMIN |
|---------|------|-------|
| View dashboard, categories, products, orders | Yes | Yes |
| Create/edit categories, products, orders | Yes | Yes |
| Delete categories & products | No | Yes |
| Delete orders | No | Yes |
| User management | No | Yes |
| Users nav item visible | No | Yes |

---

## Tech Stack

### Backend

| Technology | Purpose |
|------------|---------|
| **Node.js 22** + **TypeScript 5.9** | Runtime & type safety |
| **Express.js 5** | Web framework |
| **Prisma 7.5** + **PostgreSQL 15** | ORM + database |
| **Redis 7** (ioredis) | Cache-aside layer for API responses + session store |
| **Zod 4** | Request validation |
| **JWT** (jsonwebtoken) + **Passport.js** | Authentication |
| **bcryptjs** | Password hashing |
| **nodemon** | Hot reload (dev) |

### Frontend

| Technology | Purpose |
|------------|---------|
| **Next.js 16** (App Router) | React framework |
| **Tailwind CSS 4** | Utility-first styling |
| **shadcn/ui** (base-ui) | UI component library |
| **Zustand** | Global state management |
| **React Hook Form** + **Zod** | Form handling + validation |
| **Axios** | HTTP client with interceptors |
| **Recharts** | Dashboard charts |
| **Lucide React** | Icons |
| **Sonner** | Toast notifications |
| **date-fns** | Date formatting |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| **Docker** + **Docker Compose** | Containerization |
| **PostgreSQL 15 Alpine** | Database |
| **Redis 7 Alpine** | Cache |

---

## Architecture

```
ph-task/
├── docker-compose.yml          # All 4 services: postgres, redis, server, client
├── README.md                   # This file
│
├── server/                     # Express.js backend
│   ├── prisma/
│   │   ├── schema.prisma       # Database models & enums
│   │   └── seed.ts             # Demo data seeder
│   ├── src/
│   │   ├── config/             # App config, roles, passport strategies, logger
│   │   ├── controllers/        # Route handlers (catchAsync pattern)
│   │   ├── middlewares/        # Auth, validation, error handling, CORS
│   │   ├── routes/v1/          # Express routers
│   │   ├── services/           # Business logic layer
│   │   ├── validations/        # Zod schemas per resource
│   │   ├── utils/              # ApiError, catchAsync, apiResponse helpers
│   │   ├── client.ts           # Prisma client (PrismaPg adapter)
│   │   ├── app.ts              # Express app setup
│   │   └── index.ts            # Entry point
│   ├── Dockerfile.dev          # Dev container (node:22-slim)
│   ├── docker-entrypoint.sh    # DB push + seed + start
│   └── package.json
│
├── client/                     # Next.js frontend
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   │   ├── login/          # Public login page
│   │   │   ├── register/       # Public register page
│   │   │   └── (protected)/    # Auth-guarded pages
│   │   │       ├── dashboard/
│   │   │       ├── categories/
│   │   │       ├── products/
│   │   │       ├── orders/     # List, new, [id] detail
│   │   │       ├── restock-queue/
│   │   │       ├── activity-log/
│   │   │       └── users/      # Admin only
│   │   ├── components/
│   │   │   ├── layout/         # Sidebar, Header, AppLayout
│   │   │   └── ui/             # shadcn components + custom
│   │   ├── store/              # Zustand auth store
│   │   ├── lib/                # Axios instance, utilities
│   │   └── types/              # TypeScript interfaces
│   ├── Dockerfile.dev
│   ├── next.config.ts
│   └── package.json
```

### Request Flow

```
Browser → Next.js (port 3000) → Axios → Express API (port 8000) → Prisma → PostgreSQL
                                  ↓
                             JWT in header
                                  ↓
                          Auth middleware → Role check → Validate → Controller → Service → DB
```

---

## Database Schema

### Inventory Models

**Category**
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | Primary key |
| name | String | Unique |
| description | String? | Optional |
| isActive | Boolean | Default true |
| createdBy | FK User | Creator |

**Product**
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | Primary key |
| name | String | |
| sku | String | Unique |
| categoryId | FK Category | Required |
| price | Decimal(10,2) | |
| stock | Int | Default 0 |
| minStockThreshold | Int | Default 5 |
| status | ProductStatus | ACTIVE or OUT_OF_STOCK |
| description | String? | Optional |

**Order**
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | Primary key |
| orderNumber | String | Unique, format: ORD-YYYYMMDD-XXXX |
| customerName | String | |
| totalAmount | Decimal(12,2) | Auto-calculated |
| status | OrderStatus | PENDING→CONFIRMED→SHIPPED→DELIVERED or CANCELLED |
| notes | String? | Optional |

**OrderItem**
| Field | Type | Notes |
|-------|------|-------|
| orderId | FK Order | Cascade delete |
| productId | FK Product | Restrict delete |
| quantity | Int | |
| unitPrice | Decimal(10,2) | Snapshot at order time |
| totalPrice | Decimal(12,2) | quantity * unitPrice |
| | | Unique constraint: [orderId, productId] |

**RestockQueue**
| Field | Type | Notes |
|-------|------|-------|
| productId | FK Product | |
| currentStock | Int | Snapshot when added |
| threshold | Int | Product's minStockThreshold |
| priority | RestockPriority | HIGH / MEDIUM / LOW |
| status | RestockStatus | PENDING / COMPLETED |

**InventoryActivity**
| Field | Type | Notes |
|-------|------|-------|
| action | String | CREATE, UPDATE, DELETE, CANCEL, RESTOCK |
| entityType | String | Order, Product, Category, RestockQueue |
| description | String | Human-readable log |
| userId | FK User | Who performed the action |

### Priority Calculation

| Condition | Priority |
|-----------|----------|
| stock = 0 OR stock <= 30% of threshold | **HIGH** |
| stock <= 60% of threshold | **MEDIUM** |
| stock > 60% of threshold | **LOW** |

### Order Status Transitions

```
PENDING → CONFIRMED → SHIPPED → DELIVERED
   ↓          ↓          ↓
CANCELLED  CANCELLED  CANCELLED
```

DELIVERED and CANCELLED are terminal states.

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/v1/auth/register` | Public | Register new user (defaults to USER role) |
| POST | `/v1/auth/login` | Public | Login, returns { user, tokens } |
| POST | `/v1/auth/logout` | JWT | Invalidate refresh token |
| POST | `/v1/auth/refresh-tokens` | Public | Get new access token |

### Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/v1/categories` | manageCategories | List with search, sort, pagination |
| POST | `/v1/categories` | manageCategories | Create category |
| GET | `/v1/categories/:id` | manageCategories | Get single |
| PATCH | `/v1/categories/:id` | manageCategories | Update |
| DELETE | `/v1/categories/:id` | deleteCategory (Admin) | Delete (blocked if has products) |

### Products

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/v1/products` | manageProducts | List with search, filter by category/status, sort, pagination |
| POST | `/v1/products` | manageProducts | Create product |
| GET | `/v1/products/:id` | manageProducts | Get single with category |
| PATCH | `/v1/products/:id` | manageProducts | Update (auto-evaluates restock queue) |
| DELETE | `/v1/products/:id` | deleteProduct (Admin) | Delete (blocked if in active orders) |

### Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/v1/orders` | manageOrders | List with search, status filter, date range, sort, pagination |
| POST | `/v1/orders` | manageOrders | Create order (atomic stock deduction) |
| GET | `/v1/orders/:id` | manageOrders | Get with items + product details |
| PATCH | `/v1/orders/:id/status` | manageOrders | Update status (validates transitions) |
| POST | `/v1/orders/:id/cancel` | manageOrders | Cancel (restores stock atomically) |
| DELETE | `/v1/orders/:id` | deleteOrder (Admin) | Delete (restores stock if not cancelled) |

### Restock Queue

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/v1/restock-queue` | viewRestockQueue | List ordered by lowest stock, filter by priority |
| POST | `/v1/restock-queue/:id/restock` | restockProducts | Add stock + mark completed |
| DELETE | `/v1/restock-queue/:id` | restockProducts | Remove from queue |

### Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/v1/dashboard/stats` | viewDashboard | KPIs, charts data, recent orders, activities, 7-day revenue |

### Activity Log

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/v1/activity-log` | viewActivityLog | Paginated list with entity type filter |

### Users (Admin)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/v1/users` | manageUsers | List with search, role filter, pagination |
| PATCH | `/v1/users/:id` | manageUsers | Update role, active status |
| DELETE | `/v1/users/:id` | manageUsers | Delete user |

### Query Parameters (all list endpoints)

| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10, max: 100) |
| search | string | Text search |
| sortBy | string | Sort field |
| order | asc/desc | Sort direction |

### Response Format

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "meta": {
    "timestamp": "2026-04-02T12:00:00.000Z",
    "requestId": "uuid",
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalPages": 5,
      "totalResults": 48,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## Frontend Pages

### Public

| Route | Page | Features |
|-------|------|----------|
| `/login` | Login | Email/password form, Demo User button, Demo Admin button, split layout with branding panel |
| `/register` | Register | Name, email, password, confirm password |

### Protected (requires auth)

| Route | Page | Features |
|-------|------|----------|
| `/dashboard` | Dashboard | 8 KPI cards (2x4), 4 charts, product stock table, recent orders table, activity feed |
| `/categories` | Categories | CRUD table, search, sortable columns, pagination with rows-per-page |
| `/products` | Products | CRUD table, search, category/status filters, sortable columns, pagination, modern create/edit modal with status dropdown |
| `/orders` | Orders | Table with search, status filter, date range picker, sortable columns, three-dot dropdown menu (View, Change Status, Cancel, Delete) |
| `/orders/new` | Create Order | Two-column layout: left = dynamic item rows with product select + quantity + subtotal, right = customer info + live order summary + total. Inline stock warnings, submit disabled until valid |
| `/orders/:id` | Order Detail | Order info cards, items table, status update buttons, cancel button |
| `/restock-queue` | Restock Queue | Table sorted by lowest stock, priority badges, priority filter, restock modal, pagination |
| `/activity-log` | Activity Log | Table with action badges, entity type filter, user attribution, pagination |
| `/users` | Users (Admin) | Table with avatar, role badges, status indicator, three-dot menu (Promote/Demote, Activate/Deactivate, Delete) |

### UI Components

- **Sidebar** — Responsive, active state with orange gradient, admin-only Users link, user profile with role badge, logout with tooltip, footer with system status
- **DataTablePagination** — Page numbers, first/last/prev/next, rows-per-page selector, always visible
- **SortableHeader** — Clickable column headers with arrow indicators
- **ConfirmDialog** — Custom modal replacing native `confirm()`, danger variant with warning icon
- **Toasts** — Sonner for success/error notifications

---

## Authentication & Authorization

### Auth Flow

1. User logs in with email + password → server returns `{ user, tokens: { access, refresh } }`
2. Tokens + user stored in localStorage
3. Axios interceptor attaches `Authorization: Bearer {accessToken}` to every request
4. On 401 → interceptor attempts silent refresh via `/auth/refresh-tokens`
5. If refresh fails → clear storage, redirect to `/login`
6. `AuthGuard` component wraps protected routes, redirects unauthenticated users

### JWT Tokens

| Token | Expiry | Storage |
|-------|--------|---------|
| Access | 30 minutes | localStorage |
| Refresh | 30 days | localStorage |

### Role-Based Middleware

```typescript
// Route-level: checks roleRights map
auth('manageProducts')  // Allows USER + ADMIN
auth('deleteProduct')   // Allows ADMIN only
auth('manageUsers')     // Allows ADMIN only
```

The `auth()` middleware extracts user from JWT, looks up role rights, and returns 403 if the right is missing.

---

## Business Logic

### Order Creation (Atomic)

```
BEGIN SERIALIZABLE TRANSACTION
  1. Lock all requested products (findMany inside tx)
  2. Validate: all products ACTIVE, stock >= quantity, no duplicates
  3. Deduct stock atomically (prisma.update with { decrement })
  4. Auto-set OUT_OF_STOCK if stock reaches 0
  5. Generate order number inside tx (prevents collision)
  6. Create Order + OrderItems
  7. Evaluate restock queue inside tx
COMMIT
  8. Log activity (non-critical, outside tx)
```

Retries up to 3 times on serialization failures or order number collisions.

### Order Cancellation (Atomic)

```
BEGIN SERIALIZABLE TRANSACTION
  1. Fetch order + validate status inside tx (prevents double-cancel)
  2. Restore stock atomically (prisma.update with { increment })
  3. Set product status back to ACTIVE
  4. Update order status to CANCELLED
  5. Re-evaluate restock queue inside tx
COMMIT
  6. Log activity
```

### Stock Flow

```
Product Created → stock > 0 → ACTIVE
                → stock = 0 → OUT_OF_STOCK

Order Placed → stock decremented → if 0 → OUT_OF_STOCK
                                  → if <= threshold → add to RestockQueue

Order Cancelled → stock incremented → if > 0 → ACTIVE
                                     → remove from RestockQueue if above threshold

Restocked → stock incremented → ACTIVE → RestockQueue entry → COMPLETED
```

### Restock Priority Rules

```
stock = 0 OR stock <= 30% of threshold  →  HIGH
stock <= 60% of threshold               →  MEDIUM
stock > 60% of threshold                →  LOW
```

---

## Race Condition Handling

All critical operations use **Serializable isolation** transactions with retry logic:

| Operation | Protection |
|-----------|-----------|
| Order creation | Serializable tx + atomic `decrement` + retry on collision |
| Order cancellation | Serializable tx + status check inside tx + atomic `increment` |
| Order deletion | Serializable tx + stock restoration inside tx |
| Order number generation | Generated inside tx + unique constraint + 3x retry |
| Restock | Status check + stock update inside single tx |
| Restock queue evaluation | Transaction-aware `evaluateRestockQueueTx()` |
| Category deletion | Product count + delete in single tx |
| Product deletion | Active orders check + delete in single tx |

---

## Redis Caching

The application uses Redis as a cache-aside layer to reduce database load on read-heavy endpoints. All caching is transparent — if Redis is unavailable, the app falls back to direct database queries with zero downtime impact.

### Cache Configuration

| Endpoint | Cache Key Pattern | TTL | Description |
|----------|-------------------|-----|-------------|
| Dashboard stats | `inventory:dashboard` | 30s | All KPIs, charts, recent data |
| Categories list | `inventory:categories:{params}` | 60s | Paginated, parameterized by query |
| Products list | `inventory:products:{params}` | 60s | Paginated, parameterized by filters |
| Restock queue | `inventory:restock:{params}` | 60s | Paginated, parameterized by priority |

### Cache Invalidation

Every write operation invalidates all affected caches using pattern-based deletion:

| Mutation | Caches Invalidated |
|----------|-------------------|
| Category create/update/delete | `categories:*` + dashboard |
| Product create/update/delete | `products:*` + `product:*` + `restock:*` + dashboard |
| Order create/cancel/update/delete | `orders:*` + `products:*` + `product:*` + `restock:*` + dashboard |
| Restock product | `restock:*` + `products:*` + `product:*` + dashboard |

### Implementation Details

- **Cache-aside pattern**: Check cache → miss → query DB → store in cache → return
- **Pattern invalidation**: `delPattern('inventory:products:*')` clears all product list cache variants
- **Graceful degradation**: All cache methods return `null`/`false` on Redis failure — no errors thrown
- **Auto-connect**: Redis connects on server startup; lazy reconnect on failure
- **Serialization**: All cached values are JSON serialized/deserialized automatically

### Key Files

- `server/src/services/cache.service.ts` — CacheService singleton with `get`, `set`, `del`, `delPattern`, `wrap` methods
- `CacheKeys` — Centralized cache key constants
- `CacheTTL` — Predefined TTL values (SHORT=60s, MEDIUM=300s, LONG=900s, HOUR, DAY)

---

## Docker Setup

### Prerequisites

- Docker Desktop installed
- Ports 3000, 5432, 6379, 8000 available

### Start

```bash
docker compose up -d --build
```

This starts 4 containers:

| Container | Service | Port | Image |
|-----------|---------|------|-------|
| inventrk-postgres | PostgreSQL | 5432 | postgres:15-alpine |
| inventrk-redis | Redis | 6379 | redis:7-alpine |
| inventrk-server | Express API | 8000 | node:22-slim |
| inventrk-client | Next.js | 3000 | node:22-alpine |

The server container automatically:
1. Generates Prisma client
2. Pushes schema to PostgreSQL
3. Seeds demo data
4. Starts nodemon with legacy watch polling

### Hot Reloading

Volume mounts are configured for both server and client:

- **Server**: `./server/src` → container, nodemon with `legacyWatch: true` detects changes
- **Client**: `./client/src` → container, webpack with `poll: 1000ms` detects changes

No rebuild needed for code changes. Only rebuild if you add new npm packages:

```bash
docker compose up -d --build server client
```

### Stop

```bash
docker compose down       # Stop containers
docker compose down -v    # Stop + delete data volumes
```

### View Logs

```bash
docker logs inventrk-server -f
docker logs inventrk-client -f
```

---

## Local Development

### Without Docker

**Backend:**
```bash
cd server
pnpm install
cp .env.example .env        # Configure DATABASE_URL, REDIS_HOST, etc.
pnpm db:push                # Push schema to PostgreSQL
npx ts-node prisma/seed.ts  # Seed demo data
pnpm dev                    # Start on port 8000
```

**Frontend:**
```bash
cd client
pnpm install
cp .env.local.example .env.local   # Set NEXT_PUBLIC_API_URL
pnpm dev                            # Start on port 3000
```

Requires Node.js >= 22, PostgreSQL 15+, Redis 7+.

---

## Seed Data

The seed script (`server/prisma/seed.ts`) creates:

### Users

| Email | Password | Role |
|-------|----------|------|
| demo@example.com | Demo@1234 | USER |
| admin@example.com | Admin@1234 | ADMIN |

### Categories (6)

Electronics, Clothing & Fashion, Grocery, Books & Stationery, Home & Kitchen, Sports & Fitness

### Products (20)

Spread across all categories with varied stock levels:
- 3 products at 0 stock (OUT_OF_STOCK) → HIGH priority restock
- 4 products below threshold → MEDIUM/LOW priority restock
- 13 products with healthy stock

### Orders (20)

Spread across last 10 days with realistic status distribution:
- Recent orders: PENDING
- 2-3 days ago: CONFIRMED
- 4-5 days ago: SHIPPED
- 6+ days ago: DELIVERED
- ~10% randomly CANCELLED

### Restock Queue (9 entries)

Auto-calculated from product stock vs threshold.

### Activity Log (18 entries)

Spans 10 days of system actions.

### Re-seed

```bash
docker exec inventrk-server npx ts-node prisma/seed.ts
```

---

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| NODE_ENV | development | Environment |
| PORT | 8000 | Server port |
| DATABASE_URL | — | PostgreSQL connection string |
| JWT_SECRET | — | JWT signing secret |
| JWT_ACCESS_EXPIRATION_MINUTES | 30 | Access token TTL |
| JWT_REFRESH_EXPIRATION_DAYS | 30 | Refresh token TTL |
| REDIS_HOST | localhost | Redis hostname |
| REDIS_PORT | 6379 | Redis port |
| SMTP_HOST | — | Email SMTP host |
| SMTP_PORT | 587 | Email SMTP port |
| SMTP_USERNAME | — | SMTP username |
| SMTP_PASSWORD | — | SMTP password |
| EMAIL_FROM | — | Sender email address |
| CLIENT_URL | http://localhost:3000 | Frontend URL for CORS |

### Client

| Variable | Default | Description |
|----------|---------|-------------|
| NEXT_PUBLIC_API_URL | http://localhost:8000/v1 | Backend API base URL |
