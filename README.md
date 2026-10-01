# Apollo B7A6 Housing & Roommate Platform — Backend

Production-quality Node.js + TypeScript + Express backend for a housing & roommate platform, built with **Prisma + PostgreSQL**, **Zod validation**, **JWT bearer auth / RBAC**, **Stripe** payments, soft deletes, audit logging, and a versioned REST API.

> The original workspace also contains an unrelated frontend portfolio (`index.html`, `css/`, `js/`); this backend lives in `housing-backend/` and does **not** touch those files.

## Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js (>= 20) |
| Framework | Express 4 |
| Language | TypeScript (strict) |
| ORM | Prisma 6 + PostgreSQL |
| Validation | Zod |
| Auth | email/password + Google OAuth (configurable), JWT access/refresh |
| Payments | Stripe (real PaymentIntents + webhook) with mock fallback |
| Security | Helmet, CORS, express-rate-limit, bcrypt, httpOnly-style refresh |
| Docs | OpenAPI 3.0 (served at `/api/v1/docs/openapi.json`, redirects from `/docs`) |
| Tests | Jest + ts-jest + supertest (SQLite in-memory test DB) |

## Project layout

```
housing-backend/
├── src/
│   ├── app.ts                  # Express app, security headers, CORS, raw-body Stripe webhook
│   ├── index.ts                # HTTP server bootstrap + graceful shutdown
│   ├── config/index.ts         # Zod-validated env config
│   ├── routes/v1.ts            # Versioned router aggregation
│   ├── common/                 # apiResponse, errors, audit, pagination utilities
│   ├── middleware/             # auth (JWT), RBAC, validate (Zod), rateLimit, errorHandler, notFound
│   ├── utils/                  # prisma, security, stripe, email, logger
│   └── features/{auth,users,properties,rooms,amenities,bookings,payments,reviews,favorites,messages,audit,health,docs}/
├── prisma/
│   ├── schema.prisma           # Production schema (PostgreSQL)
│   ├── schema.test.prisma      # SQLite mirror for tests
│   └── seed.js                 # Idempotent seed data
├── tests/                      # Integration tests (jest)
├── docs/openapi.json           # Generated OpenAPI spec
├── scripts/gen-openapi.js      # OpenAPI generator
├── .env.example
├── jest.config.js
├── tsconfig.json
└── package.json
```

## Requirements coverage

- **3 roles** — `OWNER`, `TENANT`, `ADMIN` (enum + RBAC middleware).
- **Auth** — `/auth/register/tenant`, `/auth/register/owner`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`. Google OAuth is toggled via `GOOGLE_OAUTH_ENABLED` and verified server-side with `google-auth-library` (`POST /auth/google`).
- **RBAC** — every protected route uses `authenticate` + `authorize`/`requireAdmin`/`requireOwnerOrAdmin`. Ownership is enforced at the service layer (only the property owner or an admin can mutate a property/room/booking).
- **Structured responses** — uniform `{ success, statusCode, message, data, meta, error }` envelope (`apiResponse.ts`).
- **Zod validation** — `validate()` middleware on every route that accepts input.
- **Security** — Helmet, CORS (configurable origins/credentials), `express-rate-limit` (global + stricter auth limiter).
- **Soft deletes** — `deletedAt` on `User`, `Property`, `Room`, `Booking` with `deletedAt: null` scopes and `NOT` filters.
- **Audit logs** — immutable `AuditLog` table; `writeAuditLog()` invoked on every mutating action.
- **Pagination / filtering / search / sorting** — `paginateQuery`/`buildMeta` helpers used across all list endpoints.
- **Transactions** — booking creation (`createBooking`) reserves the room + creates a payment atomically; approval (`approveBooking`) flips status, occupies the room, and creates the payment atomically. All DB changes use `prisma.$transaction`.
- **Stripe** — real PaymentIntent creation on approval, `clientSecret` returned for Element-based capture, raw-body `/stripe/webhook` updating `Payment` status from `payment_intent.succeeded` / `payment_intent.payment_failed` / `charge.refunded`. Mock provider fallback when `STRIPE_ENABLED=false`.
- **Versioned APIs** — all routes are under `/api/v1/*` (**54 documented endpoints** across 13 resources, well beyond the 20 minimum).

## Setup

```bash
cd housing-backend
npm install
cp .env.example .env   # edit secrets (never commit .env)
```

### Database

```bash
# With PostgreSQL running and DATABASE_URL set:
npx prisma generate
npx prisma db push          # or: npm run db:migrate
npm run db:seed             # seed demo data
```

### Run

```bash
npm run dev                 # tsx watch
# or after build:
npm run build && npm start
```

## Tests

Tests run against an ephemeral SQLite DB (mirrors the production schema via `prisma/schema.test.prisma`), so **no PostgreSQL is required** to run them:

```bash
npm test                    # jest, runInBand
npm run test:ci             # with coverage
```

What is covered:
- Auth: register/login/refresh/logout, RBAC denial, token validation.
- Properties: owner CRUD + RBAC (tenant/owner boundaries), search/pagination, soft-delete, amenity attach/detach.
- Bookings: transactional creation, room reservation, approval → room `OCCUPIED` + payment `SUCCEEDED`; overlap conflict; owner-only approve/reject; tenant cancel.
- Payments: scoped listing + admin refund (mock mode), RBAC denial.
- Reviews: create (participant only), duplicate rejection, RBAC, delete.
- Stripe webhook: `payment_intent.succeeded` updates payment status (signature mocked), invalid signature → 400.
- Docs & health probes.

## OpenAPI / Postman

- Live spec: `GET /api/v1/docs/openapi.json` (or `GET /docs` for a redirect).
- To (re)generate: `npm run open:gen`.
- Postman: `File > Import > Link/URL` → paste `http://localhost:4000/api/v1/docs/openapi.json`, or export the served JSON into a Postman collection.

## Environment (`.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | HMAC signing secrets (≥32 chars) |
| `STRIPE_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe real payment integration |
| `GOOGLE_OAUTH_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google OAuth |
| `CORS_ORIGINS` | Comma-separated allowed origins |

## Demo admin account

Run `npm run db:seed` in a non-production evaluation database, then use:

- Email: `admin@housing.local`
- Password: `Admin1234!`

Change or rotate this credential before exposing the API publicly.

## API highlights (full list in OpenAPI spec)

Auth · Users · Properties · Rooms · Amenities · Bookings · Payments · Stripe webhook · Reviews · Favorites · Messages · Audit logs · Health

## Limitations / notes

- The provided `.env.example` uses **placeholder** secrets and a local PostgreSQL URL. Set real values before running in any non-local environment. No real secrets were committed.
- Google OAuth in this implementation exchanges a **Google ID token** obtained client-side (via Google Sign-In) for our JWTs — server-side, using `google-auth-library`. This is production-grade but does not implement the classic server-initiated OAuth *redirect* dance; enable by setting `GOOGLE_OAUTH_ENABLED=true`.
- Stripe charges require a real `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. In the default (mock) mode, approvals instantly mark payments `SUCCEEDED` without calling Stripe, which is what the test suite exercises.
- The Postgres schema is not migrated in this environment (no PostgreSQL available); tests use SQLite via `prisma/schema.test.prisma`. Run `npx prisma validate` and `npx prisma generate` against the production schema in an environment with PostgreSQL.
- Not deployed. No git commit performed.
