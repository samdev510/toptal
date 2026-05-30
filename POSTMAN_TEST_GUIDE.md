# Postman Manual Test Guide

Sequential request list for testing the Book Shop API end to end.

**Base URL:** `http://localhost:3000` (or your `PORT` from `packages/api/.env`)

## Postman setup

Create an environment with these variables:

| Variable | Description |
|----------|-------------|
| `baseUrl` | `http://localhost:3000` |
| `adminToken` | Access token from admin login |
| `userToken` | Access token from user login |
| `adminRefresh` | Admin refresh token |
| `userRefresh` | User refresh token |
| `categoryId` | UUID from categories list |
| `bookId` | UUID from books list |
| `orderId` | UUID from checkout response |

**Headers (JSON requests):**

- `Content-Type: application/json`
- Protected routes: `Authorization: Bearer {{adminToken}}` or `Bearer {{userToken}}`

## Seed accounts

After `pnpm db:seed`:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@bookshop.com` | `Admin123!` |
| User | `user@bookshop.com` | `User1234!` |

---

## Phase 1 — Health & public reads

No auth required.

| # | Method | URL | Body |
|---|--------|-----|------|
| 1 | `GET` | `{{baseUrl}}/api/health` | — |
| 2 | `GET` | `{{baseUrl}}/api/categories` | — |
| 3 | `GET` | `{{baseUrl}}/api/categories/{{categoryId}}` | — *(use `id` from step 2)* |
| 4 | `GET` | `{{baseUrl}}/api/books` | — |
| 5 | `GET` | `{{baseUrl}}/api/books?search=gatsby&page=1&limit=10` | — |
| 6 | `GET` | `{{baseUrl}}/api/books?categories={{categoryId}}` | — |
| 7 | `GET` | `{{baseUrl}}/api/books/{{bookId}}` | — *(use `id` from step 4)* |

---

## Phase 2 — Auth

| # | Method | URL | Body |
|---|--------|-----|------|
| 8 | `POST` | `{{baseUrl}}/api/auth/register` | `{"email":"testuser@example.com","password":"Test1234!"}` |
| 9 | `POST` | `{{baseUrl}}/api/auth/login` | `{"email":"user@bookshop.com","password":"User1234!"}` → save `userToken`, `userRefresh` |
| 10 | `POST` | `{{baseUrl}}/api/auth/login` | `{"email":"admin@bookshop.com","password":"Admin123!"}` → save `adminToken`, `adminRefresh` |
| 11 | `POST` | `{{baseUrl}}/api/auth/refresh` | `{"refreshToken":"{{userRefresh}}"}` |
| 12 | `POST` | `{{baseUrl}}/api/auth/logout` | `{"refreshToken":"{{userRefresh}}"}` + **Bearer `{{userToken}}`** → expect `204` |

Re-login as user before cart tests if you logged out in step 12.

---

## Phase 3 — Admin: categories & books

**Authorization:** Bearer `{{adminToken}}`

| # | Method | URL | Body |
|---|--------|-----|------|
| 13 | `POST` | `{{baseUrl}}/api/categories` | `{"name":"Poetry"}` |
| 14 | `PUT` | `{{baseUrl}}/api/categories/{{categoryId}}` | `{"name":"Fiction & Drama"}` |
| 15 | `POST` | `{{baseUrl}}/api/books` | See below → save `bookId` |
| 16 | `PUT` | `{{baseUrl}}/api/books/{{bookId}}` | `{"title":"Updated Title","price":19.99}` |
| 17 | `GET` | `{{baseUrl}}/api/books/{{bookId}}` | — *(verify update)* |

**Step 15 body** (replace `categoryId` with a real UUID from step 2):

```json
{
  "title": "Postman Test Book",
  "yearPublished": 2024,
  "authorName": "Test Author",
  "price": 9.99,
  "categoryId": "{{categoryId}}",
  "stock": 5
}
```

---

## Phase 4 — User: cart & checkout

**Authorization:** Bearer `{{userToken}}`

| # | Method | URL | Body |
|---|--------|-----|------|
| 18 | `POST` | `{{baseUrl}}/api/cart` | `{"bookId":"{{bookId}}"}` |
| 19 | `GET` | `{{baseUrl}}/api/cart` | — |
| 20 | `POST` | `{{baseUrl}}/api/cart` | `{"bookId":"<another-book-uuid>"}` *(optional second item)* |
| 21 | `POST` | `{{baseUrl}}/api/cart/checkout` | — *(no body)* → expect **`201`** + order JSON → save `orderId` |
| 22 | `GET` | `{{baseUrl}}/api/orders` | — |
| 23 | `GET` | `{{baseUrl}}/api/orders/{{orderId}}` | — |
| 24 | `GET` | `{{baseUrl}}/api/cart` | — *(should be empty after checkout)* |
| 25 | `DELETE` | `{{baseUrl}}/api/cart/{{bookId}}` | — *(add to cart again first if testing remove)* |

---

## Phase 5 — Admin cleanup (optional)

**Authorization:** Bearer `{{adminToken}}`

| # | Method | URL | Body | Notes |
|---|--------|-----|------|--------|
| 26 | `DELETE` | `{{baseUrl}}/api/books/{{bookId}}` | — | Fails **`400`** if book was ordered |
| 27 | `DELETE` | `{{baseUrl}}/api/categories/{{categoryId}}` | — | Fails **`400`** if category still has books |

---

## Negative checks (optional)

| Method | URL | Body | Auth | Expected |
|--------|-----|------|------|----------|
| `POST` | `/api/auth/login` | wrong password | — | `401` |
| `POST` | `/api/auth/register` | duplicate email | — | `409` |
| `GET` | `/api/cart` | — | none | `401` |
| `POST` | `/api/cart/checkout` | — | user, empty cart | `400` |
| `POST` | `/api/cart` | valid `bookId` | user | `400` if out of stock |
| `POST` | `/api/books` | create body | none / user | `401` / `403` |

---

## Minimal happy path (10 requests)

1. `GET /api/health`
2. `GET /api/categories` → save `categoryId`
3. `GET /api/books` → save `bookId`
4. `POST /api/auth/login` (user) → save `userToken`
5. `POST /api/auth/login` (admin) → save `adminToken`
6. `POST /api/books` (admin) — or skip and use seeded `bookId`
7. `POST /api/cart` (user)
8. `GET /api/cart` (user)
9. `POST /api/cart/checkout` (user)
10. `GET /api/orders/{{orderId}}` (user)

---

## Expected status codes

| Action | Success |
|--------|---------|
| Register / create book / add to cart / checkout | `201` |
| Login / refresh / list / get | `200` |
| Logout / delete book / delete category | `204` |
| Validation / business rule error | `400` |
| Missing or invalid token | `401` |
| Non-admin on admin route | `403` |
| Duplicate email | `409` |
