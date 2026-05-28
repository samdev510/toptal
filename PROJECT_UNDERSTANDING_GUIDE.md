# Project Understanding Guide — Book Shop API

> **Purpose:** Technical onboarding and interview preparation for the Book Shop REST API in this repository.  
> **Based on:** Actual code under `Project/` as of the current codebase (not assumptions).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Architecture](#3-project-architecture)
4. [Full Folder Structure Explanation](#4-full-folder-structure-explanation)
5. [Execution Flow](#5-execution-flow)
6. [Database Explanation](#6-database-explanation)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [API Documentation](#8-api-documentation)
9. [How to Run the Project](#9-how-to-run-the-project)
10. [How to Test the Project](#10-how-to-test-the-project)
11. [Important Business Logic](#11-important-business-logic)
12. [Security Analysis](#12-security-analysis)
13. [Performance & Scalability](#13-performance--scalability)
14. [Generated vs Handwritten Code](#14-generated-vs-handwritten-code)
15. [Interview Preparation Guide](#15-interview-prep-guide)
16. [Developer Learning Roadmap](#16-developer-learning-roadmap)
17. [Improvement Suggestions](#17-improvement-suggestions)

---

# 1. Project Overview

## What this project does

This is a **RESTful Book Shop API** built for the Toptal technical assessment (`review.txt`). It backs a simplified online bookstore where clients (web or mobile) can:

- Browse and filter books
- Register and log in
- Add books to a personal cart
- Check out (mock payment — no credit card processing)
- Let administrators manage categories and books

There is **no frontend** in this repository — only the API.

## Business / domain scenario

An online bookshop sells physical or digital books with limited inventory (`stock`). Users reserve inventory indirectly by keeping items in a cart; un purchased cart lines expire after **30 minutes** so stock becomes available again. Checkout decrements stock and records an order.

## Main use cases

| Actor | Use cases |
|--------|-----------|
| **Anonymous** | List categories, list/filter/search in-stock books, view a book |
| **Authenticated user (USER)** | Cart add/remove/view, checkout, order history |
| **Administrator (ADMIN)** | CRUD categories, CRUD books (stock set only at create) |

## Core features

- Email + password registration and login
- JWT access token (short-lived) + refresh token (stored in DB, rotatable)
- Category management (flat hierarchy — no nested categories)
- Book catalog with pagination, multi-category filter, title/author search
- Cart with **one copy per book per user** (no quantity field)
- **Cart reservation** — active cart items reduce “available” stock for other users
- **Checkout** in a DB transaction with `Serializable` isolation
- Periodic cleanup of expired cart rows (every 5 minutes)
- Sold-out books (`stock = 0`) hidden from public listing

## User roles and permissions

| Role | How assigned | Capabilities |
|------|----------------|--------------|
| `USER` | Default on register | Cart, checkout, orders |
| `ADMIN` | **Only via database** (seed or manual SQL) | All USER abilities + category/book CRUD |

There is **no API endpoint** to promote users to admin (required by the task spec).

## High-level request flow

```
Client → HTTP → Express middleware chain → Route → Controller → Service → Prisma → PostgreSQL
                                                                              ↓
Client ← JSON ← Error handler / Controller ← Service ← Prisma ← PostgreSQL
```

## Main technical goals

- Meet Toptal functional requirements (auth, CRUD, cart, checkout, race conditions)
- Support **10,000+ books** via pagination and indexed queries
- Clean separation: validation (Zod), HTTP (Express), business rules (services), persistence (Prisma)
- Safe concurrent checkout on low stock
- Usable by non-browser clients (standard REST + JSON)

---

# 2. Technology Stack

| Technology | Used? | Role | Why / interaction |
|------------|-------|------|-------------------|
| **Node.js 20+** | Yes | Runtime | Runs TypeScript API |
| **Express 4** | Yes | HTTP framework | Routing, middleware, JSON API |
| **TypeScript 5** | Yes | Language | Type safety across api + shared |
| **PostgreSQL 16** | Yes | Database | Relational data, transactions |
| **Prisma 6** | Yes | ORM | Schema, migrations, type-safe queries |
| **Zod 3** | Yes | Validation | Request bodies/queries; shared schemas |
| **JWT (`jsonwebtoken`)** | Yes | Auth | Access + refresh tokens |
| **bcrypt** | Yes | Security | Password hashing (12 rounds) |
| **pnpm workspaces** | Yes | Monorepo | `packages/api` + `packages/shared` |
| **Jest + Supertest** | Yes | Testing | HTTP integration tests |
| **tsx** | Yes | Dev | Run TS without pre-build in dev |
| **Docker Compose** | Yes | Infra | Local Postgres (+ optional test DB) |
| **Helmet** | Yes | Security | HTTP headers hardening |
| **CORS** | Yes | Security | Configurable origin |
| **express-rate-limit** | Yes | Security | 200 req / 15 min per IP (on `/api/`) |
| **ESLint + Prettier** | Yes | DX | Lint/format |
| **NestJS** | No | — | Express chosen instead |
| **GraphQL** | No | — | REST chosen per requirements |
| **Redis / cache** | No | — | Not implemented |
| **Message queue / Bull** | No | — | Cart cleanup uses `setInterval` |
| **Swagger / OpenAPI** | No | — | Manual/Postman testing |
| **CI/CD** | No | — | Not in repo |
| **Structured logging (Winston/Pino)** | No | — | `console.info` / `console.error` only |

### Environment management

- File: `packages/api/.env` (local, gitignored)
- Template: `packages/api/.env.example`
- Validated at startup via Zod in `packages/api/src/config/env.ts` — invalid config throws before the server accepts traffic

---

# 3. Project Architecture

## Architectural pattern

**Modular monolith** in a **pnpm monorepo**:

- One deployable application: `@bookshop/api`
- One shared library: `@bookshop/shared` (Zod schemas + constants)

Inside the API, the pattern is **layered / feature modules**:

```
Routes  →  Controllers  →  Services  →  Prisma Client  →  PostgreSQL
   ↑            ↑              ↑
Middleware   asyncHandler   Business rules + transactions
```

There is **no** separate repository layer, no Nest-style modules, no GraphQL resolvers.

## Monolith vs microservice

**Single monolithic API process.** All domains (auth, books, cart, orders) run in one Express app. Scaling would be horizontal copies of the same service behind a load balancer (with sticky sessions not required for JWT).

## Layer responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Routes** | URL mapping, middleware order, wire validation/auth to handlers |
| **Controllers** | HTTP status codes, call services, shape JSON responses |
| **Services** | Business logic, Prisma calls, transactions |
| **Middleware** | Cross-cutting: auth, roles, validation, errors |
| **Prisma schema** | Data model, indexes, relations |
| **Shared package** | Reusable Zod schemas and types for API (and potential future frontend) |

## Request lifecycle

```
1. Incoming HTTP request
2. helmet(), cors(), express.json()
3. rateLimit (paths under /api/)
4. Route-specific middleware:
   - validate(ZodSchema)  → may call next(ZodError)
   - authenticate         → sets req.user from JWT
   - authorize('ADMIN')  → checks req.user.role
5. Controller handler (wrapped in asyncHandler)
6. Service function
7. Prisma query / transaction
8. Response JSON or 204
9. On error: next(err) → errorHandler
```

## Architecture diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Web / Mobile)                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS JSON
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  packages/api/src/server.ts  →  app.ts (Express)                 │
│  ┌─────────────┐  ┌──────────┐  ┌────────────┐  ┌───────────┐ │
│  │ Middleware  │→ │ Routes   │→ │ Controllers│→ │ Services  │ │
│  │ auth/valid  │  │ per module│  │ thin HTTP  │  │ business  │ │
│  └─────────────┘  └──────────┘  └────────────┘  └─────┬─────┘ │
└──────────────────────────────────────────────────────│─────────┘
                                                       │
                       ┌───────────────────────────────┘
                       ▼
              ┌─────────────────┐
              │ Prisma Client   │  ← generated from schema.prisma
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │   PostgreSQL    │
              └─────────────────┘

┌──────────────────────┐
│ packages/shared      │  Zod schemas imported by api routes/services
└──────────────────────┘
```

## Authentication flow (summary)

```
Register/Login → bcrypt verify/hash → issue JWT access + refresh
              → store refresh token row in refresh_tokens table

Protected route → Authorization: Bearer <access> → verifyAccessToken → req.user

Refresh → verify refresh JWT + DB row exists & not expired → delete old row → new pair

Logout → delete refresh token row(s)
```

## Error handling flow

1. Services throw `AppError(statusCode, message)` for expected failures
2. Validation middleware passes `ZodError` to `next()`
3. `asyncHandler` catches rejected promises and calls `next(err)`
4. `errorHandler` (last middleware) maps:
   - `AppError` → `{ error: message }` + status
   - `ZodError` → `{ error: 'Invalid input', issues: {...} }` + 400
   - Other → 500 `{ error: 'Something went wrong' }` + server log

---

# 4. Full Folder Structure Explanation

## Repository root (`Project/`)

| Path | Purpose | Type |
|------|---------|------|
| `review.txt` | Original Toptal task requirements | Handwritten spec |
| `README.md` | Quick setup and endpoint list | Handwritten docs |
| `PROJECT_UNDERSTANDING_GUIDE.md` | This document | Handwritten docs |
| `package.json` | Monorepo scripts (dev, test, db, lint) | Handwritten config |
| `pnpm-workspace.yaml` | Declares `packages/*` workspaces | Handwritten config |
| `pnpm-lock.yaml` | Lockfile | Auto (pnpm) |
| `tsconfig.base.json` | Shared TS compiler defaults | Handwritten config |
| `eslint.config.mjs` | ESLint flat config | Handwritten config |
| `.prettierrc` | Formatting rules | Handwritten config |
| `.gitignore` | Ignores node_modules, dist, .env | Handwritten config |
| `docker-compose.yml` | Postgres + postgres-test services | Handwritten infra |

## `packages/shared/` — validation library

| Path | Purpose | Type |
|------|---------|------|
| `src/schemas/auth.schema.ts` | Register/login/refresh Zod schemas | Handwritten |
| `src/schemas/book.schema.ts` | Book CRUD + query schemas + inferred types | Handwritten |
| `src/schemas/category.schema.ts` | Category create/update schemas | Handwritten |
| `src/schemas/cart.schema.ts` | Add-to-cart body schema | Handwritten |
| `src/schemas/index.ts` | Re-exports schemas | Handwritten |
| `src/constants.ts` | `PAGINATION`, `ROLES`, `CART_EXPIRY_MINUTES` | Handwritten (partially unused by api runtime*) |
| `src/index.ts` | Package entry exports | Handwritten |
| `dist/**` | Compiled JS + `.d.ts` from `tsc` | **Autogenerated** — do not edit |
| `package.json` | Package metadata, build script | Handwritten |

\* API uses `env.CART_EXPIRY_MINUTES` for cart logic, not `shared` constant.

**Why it exists:** Share validation rules between API and a potential future frontend without duplicating Zod definitions.

## `packages/api/` — main application

### Entry points

| File | Purpose | Type |
|------|---------|------|
| `src/server.ts` | **Process entry** — loads env, starts HTTP listener, cart cleanup interval | Handwritten |
| `src/app.ts` | **Express app factory** — middleware + route mounting + error handler | Handwritten |

### `src/config/`

| File | Purpose | Type |
|------|---------|------|
| `env.ts` | Loads and validates `process.env` with Zod | Handwritten |

### `src/lib/`

| File | Purpose | Type |
|------|---------|------|
| `prisma.ts` | Exports singleton `PrismaClient` | Handwritten |
| `jwt.ts` | sign/verify access & refresh tokens | Handwritten |

### `src/types/`

| File | Purpose | Type |
|------|---------|------|
| `express.d.ts` | Augments Express `Request` with `user?: JwtPayload` | Handwritten |

### `src/middleware/`

| File | Purpose | Type |
|------|---------|------|
| `authenticate.ts` | Bearer JWT → `req.user` | Handwritten |
| `authorize.ts` | Role guard (`ADMIN`, etc.) | Handwritten |
| `validate.ts` | Generic Zod middleware for body/query/params | Handwritten |
| `errorHandler.ts` | Central error → JSON mapper, `AppError` class | Handwritten |
| `asyncHandler.ts` | Wraps async route handlers, forwards errors to `next` | Handwritten |

### `src/modules/<feature>/` — feature modules

Each domain has up to three files:

| Suffix | Role | Type |
|--------|------|------|
| `*.routes.ts` | Express `Router`, HTTP paths, middleware chain | Handwritten |
| `*.controller.ts` | Thin handlers: call service, set status, `res.json` | Handwritten |
| `*.service.ts` | **Core business logic** and Prisma access | Handwritten |

**Modules:**

| Module | Routes file | Controller | Service |
|--------|-------------|------------|---------|
| Auth | `auth.routes.ts` | `auth.controller.ts` | `auth.service.ts` |
| Categories | `categories.routes.ts` | `categories.controller.ts` | `categories.service.ts` |
| Books | `books.routes.ts` | `books.controller.ts` | `books.service.ts` |
| Cart | `cart.routes.ts` | `cart.controller.ts` | `cart.service.ts` |
| Orders | `orders.routes.ts` | `orders.controller.ts` | `orders.service.ts` |

### `prisma/`

| File | Purpose | Type |
|------|---------|------|
| `schema.prisma` | **Source of truth** for DB models | Handwritten |
| `seed.ts` | Dev seed users, categories, books | Handwritten |
| `migrations/` | SQL migrations | **Autogenerated** by `prisma migrate` (may be absent until first migrate) |

### `tests/`

| Path | Purpose | Type |
|------|---------|------|
| `setup.ts` | Jest hooks, `cleanDatabase()` helper | Handwritten |
| `integration/*.test.ts` | Supertest HTTP tests per domain | Handwritten |

### Config / build (api)

| File | Purpose |
|------|---------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | Project references root |
| `tsconfig.app.json` | Build `src/` → `dist/` |
| `tsconfig.test.json` | Typecheck tests with Jest globals |
| `jest.config.ts` | Jest + ts-jest config |
| `.env.example` | Env template |

### What this project does **not** have

- No `controllers/` global folder — controllers live inside each module
- No `repositories/`, `dto/`, `entities/` folders
- No `guards/` / `interceptors/` (Nest naming) — use `middleware/`
- No `hooks/` (React) or frontend
- No Swagger UI

---

# 5. Execution Flow

## Application startup (step-by-step)

1. **`pnpm dev`** runs `tsx watch src/server.ts` (see `packages/api/package.json`).
2. Node loads `server.ts`, which imports `app.ts` and `config/env.ts`.
3. **`env.ts`** runs immediately: Zod parses `process.env`. On failure → throws `Bad environment config`.
4. **`app.ts`** creates Express app, registers global middleware and routes.
5. Importing `lib/prisma.ts` constructs **`PrismaClient`** (connects lazily on first query).
6. **`server.ts`** calls `app.listen(PORT)` and logs the URL.
7. **`setInterval` every 5 minutes** calls `cleanupExpiredCarts()` from `cart.service.ts` to delete expired `cart_items` rows.

## How routes are registered

In `app.ts`:

```typescript
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
```

Each `*.routes.ts` exports a default `Router` mounted at that prefix.

## Example: authenticated checkout

```
POST /api/orders/checkout
  Authorization: Bearer <accessToken>

1. rateLimit
2. orders router → router.use(authenticate) on all order routes
3. ordersController.checkout (asyncHandler)
4. ordersService.checkout(userId)
5. prisma.$transaction (Serializable):
   - Load non-expired cart items for user
   - Verify each book stock > 0
   - Decrement stock per book
   - Create Order + OrderItems (price snapshot)
   - Delete all user's cart items
6. 201 + order JSON
```

## Example: add to cart (reservation logic)

```
POST /api/cart  { "bookId": "uuid" }

1. authenticate → req.user.userId
2. validate(addToCartSchema)
3. cartService.addToCart → $transaction:
   - Book exists, stock > 0
   - No duplicate active cart line for user+book
   - Count active cart reservations for book (addedAt within 30 min)
   - effectiveStock = book.stock - reservations
   - If effectiveStock > 0 → create CartItem
```

---

# 6. Database Explanation

## Schema overview (Prisma models)

| Model | Table | Purpose |
|-------|-------|---------|
| `User` | `users` | Accounts, role enum, password hash |
| `Category` | `categories` | Flat category names (unique) |
| `Book` | `books` | Catalog, price, stock, FK to category |
| `CartItem` | `cart_items` | User's cart lines, `addedAt` for expiry |
| `Order` | `orders` | Checkout header, total amount |
| `OrderItem` | `order_items` | Line items with `priceAtPurchase` snapshot |
| `RefreshToken` | `refresh_tokens` | Server-side refresh token storage |

## Relationships (ER diagram)

```
Category 1 ── * Book
User 1 ── * CartItem * ── 1 Book
User 1 ── * Order 1 ── * OrderItem * ── 1 Book
User 1 ── * RefreshToken
```

## Important constraints

- `CartItem`: `@@unique([userId, bookId])` — one line per book per user
- `Book.stock`: set at create; **update schema intentionally omits stock** (business rule)
- `OrderItem.priceAtPurchase`: preserves price at checkout time
- Indexes on `books(categoryId)`, `books(stock)`, `cart_items(addedAt)`, `orders(userId)`, `refresh_tokens(userId|expiresAt)`

## Migrations

- Command: `pnpm db:migrate` → `prisma migrate dev`
- Migration SQL is **generated by Prisma** from `schema.prisma` changes
- If `prisma/migrations/` is empty, run migrate once to create initial migration

## Seed data (`prisma/seed.ts`)

| Handwritten content | Details |
|---------------------|---------|
| Users | `admin@bookshop.com` / `Admin123!` (ADMIN), `user@bookshop.com` / `User1234!` (USER) |
| Categories | Fiction, Non-Fiction, Science, History, Technology, Philosophy |
| Books | Sample titles (only inserted if `book.count() === 0`) |

## ORM usage patterns

- **Reads:** `findMany`, `findUnique`, `count` with `where`, `include`, `skip/take`
- **Writes:** `create`, `update`, `delete`, `deleteMany`
- **Transactions:** `prisma.$transaction` in cart add and checkout
- **Checkout isolation:** `TransactionIsolationLevel.Serializable` — strongest isolation for race-prone stock updates

## Handwritten vs generated DB code

| Generated | Handwritten |
|-----------|-------------|
| `@prisma/client` types and client | `schema.prisma`, `seed.ts`, all service queries |

---

# 7. Authentication & Authorization

## Login / register flow

1. **Register:** hash password (bcrypt, 12 rounds) → create `User` with role `USER` → issue tokens
2. **Login:** find user → `bcrypt.compare` → issue tokens
3. **Tokens:**
   - **Access JWT:** payload `{ userId, role }`, secret `JWT_ACCESS_SECRET`, default expiry `15m`
   - **Refresh JWT:** same payload, different secret, default expiry `7d`, **also stored** in `refresh_tokens` with `expiresAt`

## Refresh flow (rotation)

1. Client sends `{ refreshToken }` to `POST /api/auth/refresh`
2. Verify JWT signature with refresh secret
3. Load DB row by token; reject if missing or expired
4. **Delete** old refresh row (one-time use rotation)
5. Issue new access + refresh pair; store new refresh row

## Middleware

| Middleware | When | Effect |
|------------|------|--------|
| `authenticate` | Protected routes | Requires `Authorization: Bearer <access>` |
| `authorize('ADMIN')` | Admin mutations | Requires `req.user.role === 'ADMIN'` |

Access token is **not** checked against a server-side store (stateless JWT). Refresh token **is** stored for revocation.

## Role-based permissions

| Endpoint group | Anonymous | USER | ADMIN |
|----------------|-----------|------|-------|
| `GET /api/books`, categories | Yes | Yes | Yes |
| Cart, orders | No | Yes | Yes |
| POST/PUT/DELETE books, categories | No | No | Yes |

## Security considerations

- Passwords never stored plain text
- Separate secrets for access vs refresh tokens
- Generic login error message (`Wrong email or password`)
- Admin only via DB prevents privilege escalation via API
- Logout deletes refresh token from DB

---

# 8. API Documentation

Base URL: `http://localhost:3000`

## Response conventions

- **Success:** JSON body directly (e.g. user object, book, `{ items, total, page, limit, totalPages }`)
- **No content:** `204` for delete/logout
- **Error:** `{ "error": "message" }` or validation `{ "error": "Invalid input", "issues": { ... } }`

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | `{ "ok": true }` |

## Auth

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/api/auth/register` | No | `{ email, password }` min 8 chars |
| POST | `/api/auth/login` | No | `{ email, password }` |
| POST | `/api/auth/refresh` | No | `{ refreshToken }` |
| POST | `/api/auth/logout` | Bearer | `{ refreshToken }` |

**Register response (201):**

```json
{
  "user": { "id": "uuid", "email": "...", "role": "USER" },
  "accessToken": "...",
  "refreshToken": "..."
}
```

## Categories

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/categories` | No |
| GET | `/api/categories/:id` | No |
| POST | `/api/categories` | Admin |
| PUT | `/api/categories/:id` | Admin |
| DELETE | `/api/categories/:id` | Admin |

## Books

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/books` | No | Query: `categories=id1,id2`, `search`, `page`, `limit` (max 100). **Only stock > 0** |
| GET | `/api/books/:id` | No | Includes category |
| POST | `/api/books` | Admin | Body includes `stock` (required) |
| PUT | `/api/books/:id` | Admin | **Cannot update stock** |
| DELETE | `/api/books/:id` | Admin | Blocked if book has order history |

## Cart (all routes require auth)

| Method | Path | Body |
|--------|------|------|
| GET | `/api/cart` | — |
| POST | `/api/cart` | `{ "bookId": "uuid" }` |
| DELETE | `/api/cart/:bookId` | — |

## Orders (all routes require auth)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/orders/checkout` | Purchases cart (mock payment) |
| GET | `/api/orders` | List user's orders |
| GET | `/api/orders/:id` | Order detail (own orders only) |

## Business-critical / complex endpoints

1. **`POST /api/orders/checkout`** — Serializable transaction, stock checks, order creation
2. **`POST /api/cart`** — Reservation / effective stock calculation
3. **`GET /api/books`** — Pagination + filters (scale path)

---

# 9. How to Run the Project

## Prerequisites

- Node.js **20+**
- pnpm **9+**
- Docker (for local PostgreSQL) **recommended**

## Installation

```bash
cd Project
pnpm install
```

## Database (Docker)

```bash
docker compose up -d
```

Services:

- `postgres` → `localhost:5432` (main DB)
- `postgres-test` → `localhost:5433` (optional separate test DB)

## Environment

```bash
cp packages/api/.env.example packages/api/.env
```

Edit secrets in production. Defaults match `docker-compose.yml`.

## Prisma

```bash
pnpm --filter @bookshop/api db:generate   # Generate @prisma/client
pnpm db:migrate                            # Create tables (migrate dev)
pnpm db:seed                               # Seed admin/user + sample data
```

## Run

```bash
pnpm dev      # Development with hot reload (tsx)
# or
pnpm build && pnpm start   # Compiled JS from dist/
```

## Troubleshooting

| Issue | Likely cause | Fix |
|-------|----------------|-----|
| `Bad environment config` | Missing/invalid `.env` | Copy `.env.example`, set `DATABASE_URL` |
| ECONNREFUSED Postgres | Docker not running | `docker compose up -d` |
| Prisma client errors | Client not generated | `pnpm --filter @bookshop/api db:generate` |
| `EBUSY` on Windows (Prisma engines) | File lock during generate | Retry; close processes locking `node_modules` |
| 401 on protected routes | Missing/expired JWT | Login again, use `Authorization: Bearer ...` |
| Tests fail | DB not reachable / wrong URL | Point `DATABASE_URL` to running Postgres |

---

# 10. How to Test the Project

## Manual testing (Postman / curl / HTTPie)

1. `GET /api/health`
2. `POST /api/auth/register` or use seed users via `POST /api/auth/login`
3. Copy `accessToken` into Authorization header
4. Admin: create category → create book with stock
5. User: `GET /api/books?categories=<id>`
6. `POST /api/cart` with `bookId`
7. `POST /api/orders/checkout`
8. Verify `GET /api/cart` empty and book stock decremented

**No Swagger** is bundled — use Postman collections or curl.

## Seed accounts

| Email | Password | Role |
|-------|----------|------|
| admin@bookshop.com | Admin123! | ADMIN |
| user@bookshop.com | User1234! | USER |

## Automated tests

```bash
pnpm test
```

- **Framework:** Jest + Supertest
- **Location:** `packages/api/tests/integration/`
- **Setup:** `cleanDatabase()` wipes tables between tests (order matters for FKs)
- **Requires:** Live PostgreSQL at `DATABASE_URL` in `.env`

### Test files

| File | Covers |
|------|--------|
| `auth.test.ts` | Register, login, refresh rotation, logout |
| `categories.test.ts` | List, admin create, non-admin forbidden, delete with books |
| `books.test.ts` | Sold-out hidden, admin update without stock change |
| `cart-and-checkout.test.ts` | Checkout flow, race on last copy |

### Simulating race condition (two buyers, one book)

Covered in `cart-and-checkout.test.ts`: two users with same book in cart, parallel checkout — exactly one succeeds with `201`.

### Simulating cart expiry

Wait 30+ minutes or temporarily set `CART_EXPIRY_MINUTES=1` in `.env`, add to cart, wait, verify book becomes available to others.

---

# 11. Important Business Logic

## Most important services

| Service | Critical logic |
|---------|----------------|
| `cart.service.ts` | Expiry threshold, effective stock, duplicate cart prevention |
| `orders.service.ts` | Serializable checkout, stock decrement, price snapshot |
| `auth.service.ts` | Password hashing, refresh rotation, token persistence |
| `books.service.ts` | Hide `stock <= 0`, pagination, no stock on update |
| `categories.service.ts` | Cannot delete category with books |

## Cart expiry

- Config: `CART_EXPIRY_MINUTES` (default 30) in env
- **Read path:** cart queries filter `addedAt >= now - expiry`
- **Background:** `server.ts` interval deletes expired rows every 5 minutes
- **Add path:** expired duplicate cart line is removed and replaced

## Concurrency / checkout

`orders.service.ts` uses **Serializable** transaction isolation so two checkouts cannot oversell the last unit.

## Validation

- HTTP layer: Zod via `validate()` middleware and `bookQuerySchema.parse` in controller
- Schemas live in `@bookshop/shared` — single source for rules like password min length, UUID category ids

## Edge cases handled

| Scenario | Behavior |
|----------|----------|
| Duplicate email register | 409 |
| Book out of stock | Hidden from list; cart add fails |
| All stock reserved in carts | Cart add fails (`No copies left`) |
| Checkout with empty cart | 400 |
| Checkout with stale cart / OOS | 400 with book titles |
| Delete category with books | 400 |
| Delete book with orders | 400 |
| Used refresh token | 401 |

---

# 12. Security Analysis

| Area | Implementation |
|------|----------------|
| Authentication | JWT Bearer access tokens |
| Password storage | bcrypt, 12 rounds |
| Input validation | Zod on bodies; query parsing for books |
| SQL injection | Prisma parameterized queries |
| XSS | API returns JSON, not HTML (client responsibility) |
| CSRF | Not applicable for pure Bearer-token API (no cookies for auth) |
| Rate limiting | 200 requests / 15 min (global on mounted routes before `/api/*` paths — see `app.ts`) |
| Headers | Helmet |
| CORS | Restricted to `CORS_ORIGIN` env |
| Secrets | `.env` gitignored — must rotate in production |
| Access control | Middleware + role enum |
| Refresh token theft | Mitigated partially by rotation + DB storage; no binding to device |

---

# 13. Performance & Scalability

## Pagination

`GET /api/books` uses `page` and `limit` (default 20, max 100) with `skip/take` and `count` in parallel.

## Indexing

Prisma schema indexes `categoryId`, `stock` on books; `addedAt` on cart items — supports filter + cleanup.

## Query patterns

- List books: single `findMany` + `count` with shared `where`
- Includes only needed relations (`category` name/id)

## Bottlenecks / limits

| Area | Note |
|------|------|
| Serializable checkout | Correctness over throughput; may retry under contention |
| Cart reservation count | Per-add transaction counts cart rows for book |
| No caching | Every request hits Postgres |
| Single process cleanup | `setInterval` not distributed — multiple instances would each run cleanup (acceptable idempotent deletes) |

## Scale to 10k+ books

Pagination + indexed filters address listing scale; not loading full catalog in one response.

---

# 14. Generated vs Handwritten Code

## Autogenerated (do not edit manually)

| Artifact | Tool | Regenerate with |
|----------|------|-----------------|
| `node_modules/` | pnpm | `pnpm install` |
| `packages/shared/dist/**` | TypeScript | `pnpm --filter @bookshop/shared build` |
| `packages/api/dist/**` | TypeScript | `pnpm --filter @bookshop/api build` |
| `@prisma/client` types | Prisma | `prisma generate` |
| `prisma/migrations/**` | Prisma Migrate | `prisma migrate dev` |
| `pnpm-lock.yaml` | pnpm | `pnpm install` |

## Framework / boilerplate (handwritten but standard patterns)

| Code | Notes |
|------|-------|
| Express `Router()` setup | Standard Express pattern |
| `asyncHandler` | Small wrapper — handwritten utility |
| `validate()` middleware | Generic Zod helper — handwritten |
| Prisma `schema.prisma` | Handwritten model definitions (not generated) |

## Handwritten business logic (interview focus)

| Location | Why it matters |
|----------|----------------|
| `cart.service.ts` | Reservation + expiry |
| `orders.service.ts` | Checkout transaction |
| `auth.service.ts` | Token lifecycle |
| `books.service.ts` | Stock visibility rules, no stock update |
| `categories.service.ts` | Delete guards |
| `packages/shared/src/schemas/**` | Domain validation rules |
| `prisma/seed.ts` | Demo data |

## How to recognize in the repo

- **`*.service.ts`** → almost always core domain logic  
- **`*.controller.ts`** → thin HTTP glue  
- **`dist/` or `node_modules/.prisma`** → generated  
- **`schema.prisma`** → handwritten source; migrations are derived  

---

# 15. Interview Preparation Guide

## How to present this project (2–3 minute pitch)

> “I built a REST bookshop API for a Toptal assessment: Express and TypeScript in a pnpm monorepo, PostgreSQL with Prisma. It supports anonymous browsing, JWT auth with refresh rotation, admin CRUD for catalog, and a cart with 30-minute reservations. Checkout uses serializable transactions to prevent overselling when stock is low. Validation is shared via Zod in a internal package. I added integration tests with Supertest and Dockerized Postgres for local dev.”

## Architecture decisions to highlight

1. **Layered modules** — routes/controllers/services for clarity and testability  
2. **Zod in shared package** — validation contract reusable by future clients  
3. **Refresh tokens in DB** — revocation and rotation vs pure stateless JWT  
4. **Cart reservations** — soft hold on inventory before purchase  
5. **Serializable checkout** — correctness for race conditions (tradeoff: contention cost)  
6. **Stock immutable after create** — explicit business rule from requirements  

## Common interviewer questions & sample answers

**Q: Why Express instead of NestJS?**  
A: The scope is a focused REST API; Express keeps the surface area small and avoids framework ceremony while still using clear module boundaries.

**Q: How do you prevent selling the same last book twice?**  
A: Checkout runs in a Prisma transaction with `Serializable` isolation, re-checks stock, then decrements. Only one transaction can commit successfully for the last unit.

**Q: How does the 30-minute cart work?**  
A: `addedAt` timestamp on cart items; reads filter active items; adding to cart counts reservations against effective stock; a background job deletes expired rows.

**Q: Why are admins only in the DB?**  
A: It was an explicit requirement to prevent privilege escalation through the public API.

**Q: How would you scale this?**  
A: Stateless API instances behind a load balancer, connection pooling to Postgres, read replicas for catalog reads, Redis cache for hot lists, and possibly moving checkout to a queue for peak load — Serializable may need tuning.

## Files to discuss first (technical walkthrough)

1. `prisma/schema.prisma` — data model  
2. `orders.service.ts` — checkout transaction  
3. `cart.service.ts` — reservations  
4. `auth.service.ts` — security  
5. `app.ts` + one `*.routes.ts` — HTTP pipeline  

## Sample architecture whiteboard

```
[Client] → [Express Middleware] → [Module Router] → [Controller] → [Service] → [Prisma] → [Postgres]
                ↑ Zod validate       ↑ JWT auth
```

---

# 16. Developer Learning Roadmap

## Recommended reading order

| Step | What to read | Goal |
|------|----------------|------|
| 1 | `review.txt` + `README.md` | Requirements |
| 2 | `prisma/schema.prisma` | Data model |
| 3 | `src/app.ts` + `src/server.ts` | Boot & HTTP pipeline |
| 4 | `src/middleware/*` | Auth, validation, errors |
| 5 | `packages/shared/src/schemas/*` | Input contracts |
| 6 | `auth.service.ts` → `auth.routes.ts` | End-to-end auth |
| 7 | `books.service.ts` | Catalog rules |
| 8 | `cart.service.ts` + `orders.service.ts` | Hardest business logic |
| 9 | `tests/integration/*` | Expected behavior |

## Beginner-friendly path

Start with **read-only flows** (`GET /api/books`) before cart/checkout. Use Prisma Studio (`pnpm db:studio`) to inspect tables after seeding.

## Most important modules first

1. **Orders + Cart** (differentiators)  
2. **Auth**  
3. **Books + Categories** (CRUD + filters)  

---

# 17. Improvement Suggestions

| Area | Suggestion |
|------|------------|
| **Structure** | Merge `shared` into `api/src/schemas` if no frontend — reduces monorepo complexity |
| **Migrations** | Commit `prisma/migrations` after first migrate for reproducible deploys |
| **Testing** | Use `postgres-test` service with separate `DATABASE_URL` in test env |
| **Observability** | Add Pino/Winston structured logging, request IDs |
| **API docs** | OpenAPI/Swagger from Zod schemas |
| **CI** | GitHub Actions: lint, typecheck, test with service container |
| **Cart cleanup** | Distributed lock or single scheduler job if multiple replicas |
| **Checkout** | Consider `SELECT FOR UPDATE` on book rows with `ReadCommitted` + explicit locks as alternative to Serializable |
| **Admin** | Document SQL snippet to promote user to ADMIN |
| **Health** | Add DB connectivity check to `/api/health` |

---

## Quick reference — npm scripts (root)

| Script | Action |
|--------|--------|
| `pnpm dev` | Start API in watch mode |
| `pnpm build` | Build all workspace packages |
| `pnpm test` | Run API integration tests |
| `pnpm db:migrate` | Prisma migrate dev |
| `pnpm db:seed` | Seed database |
| `pnpm lint` / `pnpm typecheck` | Quality checks |

---

*End of guide. For task source requirements, see `review.txt`.*
