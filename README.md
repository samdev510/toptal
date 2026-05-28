# Book Shop API

REST API for the Toptal bookshop exercise — browse books, cart, checkout. Node, Express, Prisma, Postgres.

## Setup

```bash
pnpm install
docker compose up -d
cp packages/api/.env.example packages/api/.env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Server: http://localhost:3000

Seed logins:
- admin@bookshop.com / Admin123!
- user@bookshop.com / User1234!

(Admin role is set in the DB only.)

## Main endpoints

**Auth** — `POST /api/auth/register`, `/login`, `/refresh`, `/logout` (Bearer on logout)

**Categories** — `GET /api/categories` (public). Admin: POST, PUT, DELETE.

**Books** — `GET /api/books?categories=id1,id2&search=foo&page=1&limit=20` (only in-stock). Admin: CRUD. Stock set on create, not editable.

**Cart** — `GET/POST /api/cart`, `DELETE /api/cart/:bookId` (logged in). Holds expire after 30 minutes.

**Orders** — `POST /api/orders/checkout`, `GET /api/orders`, `GET /api/orders/:id`

## Notes

- Cart reservations count against stock until they expire or checkout completes.
- Checkout runs in a serializable transaction so two buyers can't grab the last copy.
- Tests need Postgres — use the `postgres-test` service in docker-compose or point `DATABASE_URL` at your test DB.

```bash
pnpm test
pnpm lint
pnpm typecheck
```
