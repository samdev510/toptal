# Book Shop API — Demo Video Script

Short guide for recording a 3–5 minute client-style walkthrough of the API.

**Goal:** Show browse → buy → admin manage. Not a code review.

---

## Recording setup

### Target length

**3–5 minutes**

### Tools (pick one)

| Tool | Notes |
|------|--------|
| **Postman** (recommended) | Clean for API demos; use `POSTMAN_TEST_GUIDE.md` |
| **OBS Studio** (free) | Screen record + optional webcam |
| **SimpleScreenRecorder** (Linux) | Lightweight, often preinstalled |

### Recording tips

- 1080p resolution
- Mic on, notifications off
- Terminal font size 14+
- Postman zoom ~110%

### Before you record

```bash
docker compose up -d
pnpm db:seed
pnpm dev
```

Confirm: `GET http://localhost:3000/api/health` → `{ "ok": true }`

**Postman environment variables:** `baseUrl`, `userToken`, `adminToken`, `bookId`, `orderId`

**Seed accounts:**

| Role | Email | Password |
|------|-------|----------|
| User | `user@bookshop.com` | `User1234!` |
| Admin | `admin@bookshop.com` | `Admin123!` |

---

## Video structure

| Time | Section |
|------|---------|
| 0:00–0:30 | Intro — what it is + stack |
| 0:30–1:30 | Public browse (no login) |
| 1:30–2:30 | User journey — login, cart, checkout, orders |
| 2:30–3:30 | Admin — create book (optional: category) |
| 3:30–4:00 | Wrap + tests mention |

---

## Full script (~4 minutes)

### Opening (~25 sec)

> Hi — this is a quick demo of the **Book Shop REST API** I built for the Toptal exercise.
>
> It's a Node.js and Express backend with **Prisma** and **PostgreSQL**, organized as a monorepo with shared validation schemas.
>
> I'll walk through the main flows a client would care about: browsing books, purchasing, and admin catalog management.

**Show:** `GET /api/health` → 200

---

### Public catalog (~45 sec)

> Anyone can browse the catalog without logging in.

| # | Method | URL |
|---|--------|-----|
| 1 | `GET` | `/api/categories` |
| 2 | `GET` | `/api/books` |
| 3 | `GET` | `/api/books?search=gatsby` |

> Books out of stock are hidden from the public list. Validation runs on all inputs via **Zod** schemas in a shared package.

---

### Customer flow (~60 sec)

> For shopping, users authenticate with JWT — access token plus refresh token.

| # | Method | URL | Body / notes |
|---|--------|-----|--------------|
| 4 | `POST` | `/api/auth/login` | `user@bookshop.com` / `User1234!` → save token |
| 5 | `POST` | `/api/cart` | `{ "bookId": "<id>" }` |
| 6 | `GET` | `/api/cart` | Show reserved item |
| 7 | `POST` | `/api/cart/checkout` | No body → **201** + order |
| 8 | `GET` | `/api/cart` | Should be empty |
| 9 | `GET` | `/api/orders` | Order history |
| 10 | `GET` | `/api/orders/:id` | Order detail with price snapshot |

**Say while demoing:**

> Cart items act as **30-minute stock reservations**, so two users can't oversell the last copy.
>
> Checkout is a **cart action** — it converts the cart into an order.
>
> Checkout uses a **serializable database transaction** for safe concurrent purchases.

---

### Admin (~45 sec)

> Admins manage categories and books. These routes require an admin role.

| # | Method | URL | Body / notes |
|---|--------|-----|--------------|
| 11 | `POST` | `/api/auth/login` | `admin@bookshop.com` / `Admin123!` |
| 12 | `POST` | `/api/books` | Create book (title, author, price, categoryId, stock) |
| 13 | `GET` | `/api/books/:id` | Verify creation |

**Optional:** `POST /api/categories` with admin token.

> Unauthorized requests are rejected **before** resource lookup, with generic error messages.

---

### Closing (~20 sec)

> That covers the core API: auth, public catalog, cart with reservations, checkout, and order history, plus admin CRUD.
>
> The project includes integration tests, Dockerized Postgres, and migrations.
>
> Thanks for watching.

**Optional:** Flash terminal with `pnpm test` passing.

---

## Minimal 2-minute version

If time is tight:

1. **Intro** (15 s)
2. `GET /api/books` (20 s)
3. Login user → add to cart → `POST /api/cart/checkout` → `GET /api/orders` (60 s)
4. Login admin → `POST /api/books` (30 s)
5. **Wrap** (15 s)

---

## Professional presentation tips

- Name each endpoint once, then show the response.
- Call out status codes: **201** create, **401/403** auth, **400** business rules.
- One smooth happy path — skip error demos unless you have spare time.
- Don't scroll through code; this is a **client demo**.
- **8–10 requests** total is enough.

---

## Submit to Git

```bash
mkdir -p demo
# Save recording as demo/bookshop-api-demo.mp4

git add demo/bookshop-api-demo.mp4 demo/DEMO_VIDEO_SCRIPT.md
git commit -m "docs: add API demo video and script"
git push
```

If the video file is large, consider Git LFS or check Toptal submission guidelines.

Add to root `README.md`:

```markdown
## Demo video

See [demo/bookshop-api-demo.mp4](demo/bookshop-api-demo.mp4) for a short API walkthrough.
```

---

## Pre-upload checklist

- [ ] Server running, seed data loaded
- [ ] Postman login works live
- [ ] Use **`POST /api/cart/checkout`** (not `/api/orders/checkout`)
- [ ] Video is 3–5 minutes, audio is clear
- [ ] File committed under `demo/` in the repository
