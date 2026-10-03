# Apollo B7A6 Housing & Roommate Platform — Backend

Production-quality Node.js + TypeScript + Express backend for a housing & roommate platform, built with **Prisma + PostgreSQL**, **Zod validation**, **JWT bearer auth / RBAC**, **Stripe** payments, **Multer + Cloudinary** image uploads, **Redis** caching, soft deletes, audit logging, and a versioned REST API.

This repository contains the backend service only; no frontend is required for the assignment.

## Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js (>= 20) |
| Framework | Express 4 |
| Language | TypeScript (strict) |
| ORM | Prisma 6 + PostgreSQL (13 models, migrations tracked in git) |
| Validation | Zod |
| Auth | email/password + Google OAuth (configurable), JWT access/refresh |
| Payments | Stripe (real PaymentIntents + Checkout Sessions + webhook) with mock fallback |
| File uploads | Multer + Cloudinary, with a local-disk driver fallback |
| Caching | Redis (ioredis) with an in-process memory fallback |
| Security | Helmet, CORS, express-rate-limit, bcrypt |
| Docs | OpenAPI 3.0 + generated Postman collection v2.1 |
| Tests | Jest + ts-jest + supertest (SQLite test DB) |

## Project layout

```
housing-backend/
├── server.ts                    # Vercel serverless entry (re-exports src/app)
├── src/
│   ├── app.ts                   # Express app, security headers, CORS, raw-body Stripe webhook, static uploads
│   ├── index.ts                 # HTTP server bootstrap + graceful shutdown
│   ├── seed.ts                  # Idempotent demo seed
│   ├── config/index.ts          # Zod-validated env config
│   ├── routes/v1.ts             # Versioned router aggregation
│   ├── common/                  # apiResponse, errors, audit
│   ├── middleware/              # auth (JWT), RBAC, validate (Zod), rateLimit, upload (Multer), errorHandler
│   ├── utils/                   # prisma, security, stripe, storage, cache, email, logger, pagination
│   └── features/{auth,users,admin,properties,rooms,images,amenities,bookings,payments,reviews,favorites,messages,audit,health,docs}/
├── prisma/
│   ├── schema.prisma            # Production schema (PostgreSQL)
│   ├── schema.test.prisma       # SQLite mirror for tests (own client output dir)
│   ├── migrations/              # Tracked migration history
│   └── (seed data lives in ../src/seed.ts, wired via prisma.config.ts)
├── tests/                       # Integration tests (jest), 9 suites / 58 cases
├── docs/
│   ├── openapi.json             # OpenAPI 3.0 spec (also served by the API)
│   └── postman-collection.json  # Postman collection v2.1 (79 requests, 15 folders)
├── scripts/                     # gen-openapi.js, gen-postman.js
├── .env.example
├── vercel.json
└── package.json
```

## Requirements coverage

- **3 roles** — `OWNER`, `TENANT`, `ADMIN` (enum + `authorize()` RBAC middleware).
- **Auth** — register tenant/owner, login, refresh (rotating refresh token), logout, `/auth/me`, email verification, password reset/change. Google sign-in exchanges a client-obtained Google ID token for our JWTs, verified server-side with `google-auth-library` (`POST /auth/google`).
- **RBAC** — every protected route uses `authenticate` + `authorize(...)`. Ownership is re-checked at the service layer, so a user cannot mutate another owner's property, room, booking, image, or message even with a valid token.
- **Structured responses** — uniform `{ success, statusCode, message, data, meta, error }` envelope for every endpoint, success and failure.
- **Zod validation** — `validate()` middleware on every endpoint that accepts input; failures return `422` with a per-field `errors` array.
- **Security** — Helmet, configurable CORS, global + stricter auth rate limiting, bcrypt password hashing, rotating refresh tokens, path-traversal guards on file deletion.
- **File uploads** — Multer memory storage with MIME allow-list, size and count limits; Multer errors surface as structured `422` responses. Files go to Cloudinary when configured, otherwise to local disk served from `/uploads`.
- **Soft deletes** — `deletedAt` on `User`, `Property`, `Room`, `Booking`, with `deletedAt: null` scopes on every read.
- **Audit logs** — `AuditLog` table with 27 action types; `writeAuditLog()` records actor, entity, before/after snapshots, IP and user agent on every mutating action.
- **Pagination / filtering / search / sorting** — `parsePagination`/`buildMeta` helpers across all list endpoints, with domain filters (city, rent range, facing, availability, date ranges).
- **Transactions** — booking creation (overlap check + room reservation + pending payment), approval (status flip + room occupancy + Stripe PaymentIntent), rejection, cancellation (with refund) and image primary-promotion all run inside `prisma.$transaction`, preventing double-booking races.
- **Stripe** — real `PaymentIntent` creation on approval plus a Checkout Session for hosted payment, raw-body `/stripe/webhook` signature verification handling `payment_intent.succeeded`, `payment_intent.payment_failed` and `charge.refunded`, and full/partial refunds. Mock provider only when `STRIPE_ENABLED=false`.
- **Caching** — Redis read-through cache for hot amenity listings with `SCAN`-based namespace invalidation; degrades to an in-process TTL cache when Redis is absent, and cache failures never break a request.
- **Statistics** — `GET /api/v1/admin/stats` (platform-wide, admin only) and `GET /api/v1/dashboard` (owner-scoped).
- **Versioned APIs** — all routes under `/api/v1/*`: **79 documented operations across 61 paths and 15 resource groups**, well beyond the 20-endpoint minimum.

## Setup

```bash
cd housing-backend
npm install
cp .env.example .env   # edit secrets (never commit .env)
```

### Database

Migrations are tracked in `prisma/migrations` and the live schema is already
in sync, so deployment is a straight `migrate deploy`:

```bash
npm run db:deploy       # apply migrations (production/CI)
npm run db:migrate      # create + apply a new migration (local development)
npm run db:status       # inspect migration state
npm run db:seed         # idempotent demo data
```

### Run

```bash
npm run dev                 # tsx watch
# or after build:
npm run build && npm start
```

### Regenerate API docs

```bash
npm run docs:gen            # regenerates docs/openapi.json AND docs/postman-collection.json
```

## Tests

Tests run against a SQLite database (a mirror of the production schema via
`prisma/schema.test.prisma`), so **no PostgreSQL is required** to run them:

```bash
npm test                    # jest, runInBand
npm run test:ci             # with coverage
```

The test schema declares its own generator `output`, so generating the SQLite
test client never overwrites the PostgreSQL client used by dev, build and seed.

What is covered (9 suites, 58 cases):
- Auth: register/login/refresh/logout, RBAC denial, token validation, weak-password rejection.
- Properties: owner CRUD + RBAC boundaries, search/pagination, soft delete, amenity attach/detach.
- Rooms: creation, status transitions, occupancy.
- Bookings: transactional creation, room reservation, approval → room `OCCUPIED` + payment `SUCCEEDED`; overlap conflict; owner-only approve/reject; tenant cancel.
- Payments: admin listing + refund, RBAC denial, ownership scoping.
- Reviews: create (participants only), duplicate rejection, RBAC, delete.
- Images: multipart upload, primary-image invariants, MIME rejection, cross-owner denial, admin override, 404 handling.
- Admin statistics: platform stats RBAC, owner dashboard scoping, validation bounds.
- Stripe webhook: `payment_intent.succeeded` updates status, invalid signature → 400.
- Docs & health probes.

## API documentation

- **Swagger/OpenAPI** — `GET /api/v1/docs/openapi.json` (also `GET /docs`, which redirects).
- **Postman** — `docs/postman-collection.json` (import directly in Postman). It is grouped into 15 folders, pre-fills the bearer token, and its test scripts capture `accessToken`, `propertyId`, `roomId` and `bookingId` into collection variables, so the whole API can be walked through without manually copying ids.
- Regenerate both with `npm run docs:gen`.

## Environment (`.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | HMAC signing secrets (>= 32 chars) |
| `STRIPE_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe real payment integration |
| `GOOGLE_OAUTH_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google OAuth |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `STORAGE_DRIVER`, `CLOUDINARY_*` | `auto` uses Cloudinary when credentials exist, else local disk |
| `UPLOAD_MAX_FILES`, `UPLOAD_MAX_FILE_SIZE_MB`, `UPLOAD_ALLOWED_MIME` | Upload constraints |
| `REDIS_URL`, `CACHE_TTL_SECONDS` | Optional Redis; leave empty to use the memory cache |

## Demo accounts

Run `npm run db:seed`, then use:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@housing.local` | `Admin1234!` |
| Owner | `owner@housing.local` | `Owner1234!` |
| Tenant | `tenant@housing.local` | `Tenant1234!` |

The seed also creates a published property with rooms, an approved booking with a
succeeded payment, a favourite and a review, so every list and detail endpoint
returns data immediately.

Rotate these credentials before exposing the API publicly.

## API highlights (full list in the OpenAPI spec)

Auth · Users · Admin statistics · Owner dashboard · Properties · Rooms · Images · Amenities · Bookings · Payments · Stripe webhook · Reviews · Favorites · Messages · Audit logs · Health

## Notes and limitations

- `.env.example` ships **placeholder** secrets and a local PostgreSQL URL. Set real values in any non-local environment. No real secrets are committed.
- Google OAuth exchanges a **Google ID token** obtained client-side (Google Sign-In) for our JWTs, verified server-side with `google-auth-library`. This avoids the classic server-initiated redirect dance; enable with `GOOGLE_OAUTH_ENABLED=true`.
- Stripe requires real `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. With `STRIPE_ENABLED=false`, approvals mark payments `SUCCEEDED` without contacting Stripe — this is the mode the automated tests exercise.
- The local-disk upload driver does not persist files on Vercel's read-only filesystem. Configure Cloudinary for production deployments; the driver falls back automatically if Cloudinary is unreachable.
- Redis is optional. Without `REDIS_URL`, caching uses an in-process TTL map, so behaviour is unchanged apart from cross-instance cache sharing.
- Deployment target is Vercel (`server.ts` is the serverless entrypoint). Set the production environment variables, deploy, and verify `/api/v1/health` before submission.