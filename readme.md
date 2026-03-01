# 📦 S.I.S.M.S — Smart Inventory & Sales Management System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748.svg)](https://www.prisma.io/)
[![Express](https://img.shields.io/badge/Express-5.x-lightgrey.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

An enterprise-grade RESTful API for multi-tenant retail and warehouse environments. Built for correctness, observability, and operational safety — every design decision is deliberate.

---

## ✨ Feature Highlights

| Capability                 | Detail                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Multi-tenant**           | Every resource is org-scoped. One deployment, unlimited organizations.                                          |
| **Dual auth system**       | Separate JWT flows for `SystemUser` (platform ops) and `OrgUser` (tenants). RBAC on every route.                |
| **Immutable stock ledger** | Every stock change is a `StockMovement` record. `stockLevel` is a cache; the ledger is truth.                   |
| **Transactional sales**    | `approveSale` deducts stock atomically. Partial failures roll back completely.                                  |
| **Price snapshots**        | `SaleItem.unitPrice` locks the price at sale creation. Future price changes never corrupt history.              |
| **Smart forecasting**      | Moving-average velocity algorithm calculates days-until-stockout per product.                                   |
| **Real-time SSE**          | 7 event types pushed to all connected org clients the instant they happen.                                      |
| **Email notifications**    | BullMQ queue + Nodemailer worker. 4 transactional email templates. Fire-and-forget; never blocks API responses. |
| **Full audit trail**       | Every sensitive action logged to `UserActivity` with actor, IP, and metadata.                                   |
| **OpenAPI 3.0 docs**       | All 45+ routes documented and testable at `/api/v1/docs`.                                                       |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Express HTTP Server                       │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────────┐ │
│  │   Auth   │ │ Org Users│ │ Inventory │ │       Sales        │ │
│  │ (JWT+    │ │  (RBAC   │ │ (Products,│ │ (PENDING→APPROVED  │ │
│  │  RBAC)   │ │  mgmt)   │ │  Stock,   │ │  →COMPLETED /      │ │
│  │          │ │          │ │ Forecast) │ │   CANCELLED)       │ │
│  └──────────┘ └──────────┘ └───────────┘ └────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Shared Infrastructure                     │ │
│  │  ActivityService │ SSEManager │ EmailQueue │ RedisCache      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
    PostgreSQL              Redis              SMTP Server
  (Prisma ORM +          (Cache +           (Nodemailer via
   pg Driver Adapter)    BullMQ Queue)       BullMQ Worker)
```

**Request flow:** `HTTP → authenticate → requireOrgAccess → authorize(role) → validate(zod) → controller → service → Prisma → DB`

**Notification flow:** `service completes → SSEManager.broadcast() [sync] + enqueueEmail() [async] → BullMQ worker → Nodemailer → SMTP`

---

## 🗂️ Project Structure

```
├── prisma/
│   └── schema/                 # Multi-file Prisma schema
│       ├── main.prisma         # Generator + datasource
│       ├── organization.prisma
│       ├── orgUser.prisma
│       ├── systemUser.prisma
│       ├── inventory.prisma    # Category, Product, StockMovement
│       ├── sales.prisma        # Sale, SaleItem
│       └── userActivity.prisma
│
├── src/
│   ├── config/                 # DB, Redis, env validation (Zod)
│   ├── docs/                   # swagger.yaml + setup
│   ├── libs/
│   │   ├── activity.service.ts # Fire-and-forget audit logger
│   │   ├── email/
│   │   │   ├── email.templates.ts   # Inline HTML email templates
│   │   │   ├── email.queue.ts       # BullMQ Queue + typed enqueueEmail()
│   │   │   └── email.worker.ts      # BullMQ Worker + Nodemailer transport
│   │   └── sse/
│   │       └── sse.manager.ts       # SSE connection registry + broadcast
│   ├── middlewares/
│   │   ├── auth.middleware.ts        # JWT verify → req.user
│   │   ├── orgAccess.middleware.ts   # Slug → org lookup → req.org
│   │   ├── authorize.middleware.ts   # Role hierarchy enforcement
│   │   ├── validate.middleware.ts    # Zod schema validation
│   │   ├── logger.middleware.ts      # pino-http request logging
│   │   └── error.middleware.ts       # Global error handler
│   ├── module/
│   │   ├── auth/               # org-auth, system-auth, token service
│   │   ├── system-users/       # SystemUser + Organization management
│   │   ├── org-users/          # OrgUser CRUD + self-service
│   │   ├── inventory/          # Categories, Products, Stock, Forecasting
│   │   ├── sales/              # Full sale lifecycle
│   │   └── sse/                # GET /events SSE endpoint
│   ├── types/                  # Express augmentations (req.user, req.org)
│   ├── utils/                  # AppError, response helpers, pagination
│   ├── app.ts                  # Express app (routes wired)
│   └── server.ts               # Bootstrap: DB + Redis + worker + SSE heartbeat
│
├── src/__tests__/
│   ├── setup.ts                # Global Prisma/Redis/SSE/email mocks
│   ├── unit/
│   │   ├── auth/               # OrgAuthService unit tests
│   │   ├── inventory/          # InventoryService unit tests
│   │   └── sales/              # SalesService unit tests
│   └── integration/
│       └── app.test.ts         # Supertest HTTP integration tests
│
├── Dockerfile                  # Multi-stage build (deps → builder → production)
├── docker-compose.yml          # PostgreSQL + Redis + API + migrate service
├── jest.config.ts
├── tsconfig.json
├── tsconfig.test.json
└── .env.example
```

---

## 🔐 Auth & RBAC

### Two independent user types

| Type         | Prefix              | Roles                                        | Scope            |
| ------------ | ------------------- | -------------------------------------------- | ---------------- |
| `SystemUser` | `/api/v1/sys-auth/` | `SYSTEM_ADMIN`                               | Platform-wide    |
| `OrgUser`    | `/api/v1/org-auth/` | `ORG_SUPER_ADMIN` › `ORG_ADMIN` › `ORG_USER` | Per-organization |

### Role hierarchy (org users)

```
ORG_SUPER_ADMIN  ──┐
ORG_ADMIN        ──┤── "Managers" — can approve/cancel sales, adjust stock, manage users
ORG_USER         ──┘── can read everything in their org, create sales, change own password
```

### Token strategy

- **Access token** — 15-minute JWT, stateless
- **Refresh token** — 7-day JWT, stored hashed in PostgreSQL + JTI in Redis blacklist
- **Password change** — invalidates all refresh tokens instantly (pipeline-deleted from DB + blacklisted in Redis)

---

## 📡 API Surface

Base URL: `http://localhost:5000/api/v1`  
Interactive docs: `http://localhost:5000/api/v1/docs`

### Auth

| Method | Route                | Description                             |
| ------ | -------------------- | --------------------------------------- |
| `POST` | `/org-auth/register` | Register org + super-admin              |
| `POST` | `/org-auth/login`    | Login (returns access + refresh tokens) |
| `POST` | `/org-auth/refresh`  | Rotate refresh token                    |
| `POST` | `/org-auth/logout`   | Revoke current refresh token            |
| `POST` | `/sys-auth/login`    | System admin login                      |

### System (SYSTEM_ADMIN only)

| Method  | Route                         | Description                        |
| ------- | ----------------------------- | ---------------------------------- |
| `GET`   | `/sys/orgs`                   | List all organizations             |
| `PATCH` | `/sys/orgs/:orgId`            | Update organization                |
| `POST`  | `/sys/orgs/:orgId/deactivate` | Cascade-deactivate org + all users |
| `GET`   | `/sys/users`                  | List all system users              |
| `POST`  | `/sys/users`                  | Create system user                 |

### Org Users (org-scoped)

| Method  | Route                              | Auth                                 |
| ------- | ---------------------------------- | ------------------------------------ |
| `GET`   | `/orgs/:slug/users`                | Managers see all; ORG_USER sees self |
| `POST`  | `/orgs/:slug/users`                | Managers only — sends welcome email  |
| `PATCH` | `/orgs/:slug/users/:id`            | Manager can edit below their role    |
| `POST`  | `/orgs/:slug/users/:id/deactivate` | Managers+                            |
| `GET`   | `/orgs/:slug/users/me`             | Self — own profile                   |
| `PATCH` | `/orgs/:slug/users/me/password`    | Self — triggers security email       |

### Inventory

| Method         | Route                                          | Auth                       |
| -------------- | ---------------------------------------------- | -------------------------- |
| `GET/POST`     | `/orgs/:slug/inventory/categories`             | Read: all; Write: managers |
| `GET/POST`     | `/orgs/:slug/inventory/products`               | Read: all; Write: managers |
| `PATCH/DELETE` | `/orgs/:slug/inventory/products/:id`           | Managers                   |
| `POST`         | `/orgs/:slug/inventory/products/:id/stock`     | Managers — stock IN/OUT    |
| `GET`          | `/orgs/:slug/inventory/products/:id/movements` | All roles                  |
| `GET`          | `/orgs/:slug/inventory/insights/alerts`        | All roles                  |
| `GET`          | `/orgs/:slug/inventory/insights/forecast`      | Managers                   |

### Sales

| Method  | Route                            | Auth                                 |
| ------- | -------------------------------- | ------------------------------------ |
| `POST`  | `/orgs/:slug/sales`              | All roles — creates PENDING sale     |
| `GET`   | `/orgs/:slug/sales`              | All roles (ORG_USER sees own only)   |
| `GET`   | `/orgs/:slug/sales/summary`      | Managers — revenue analytics         |
| `GET`   | `/orgs/:slug/sales/:id`          | All roles (ORG_USER owns guard)      |
| `PATCH` | `/orgs/:slug/sales/:id/approve`  | Managers — commits stock             |
| `PATCH` | `/orgs/:slug/sales/:id/complete` | Managers — final state               |
| `PATCH` | `/orgs/:slug/sales/:id/cancel`   | Managers — returns stock if approved |

### Real-time Events (SSE)

| Method | Route                | Description                 |
| ------ | -------------------- | --------------------------- |
| `GET`  | `/orgs/:slug/events` | SSE stream — all org events |

**Event types:** `stock.adjusted` · `stock.low` · `sale.created` · `sale.approved` · `sale.completed` · `sale.cancelled` · `forecast.updated` · `ping`

---

## ⚡ Real-time Events (SSE)

Connect from the browser:

```javascript
const es = new EventSource(
    "http://localhost:5000/api/v1/orgs/acme-corp/events",
    {
        headers: { Authorization: `Bearer ${accessToken}` },
    },
);

es.addEventListener("sale.approved", (e) => {
    const { saleId, totalAmount, approvedByName } = JSON.parse(e.data);
    console.log(`Sale ${saleId} approved for ${totalAmount}`);
});

es.addEventListener("stock.low", (e) => {
    const { productName, currentStock, reorderPoint } = JSON.parse(e.data);
    showAlert(`Low stock: ${productName} — only ${currentStock} left`);
});
```

---

## 📧 Email Notifications

| Trigger                      | Template                             | Recipient      |
| ---------------------------- | ------------------------------------ | -------------- |
| New user created             | Welcome + temporary password         | New user       |
| Password changed             | Security alert, all sessions revoked | Affected user  |
| Sale approved                | Sale confirmation with totals        | Sale creator   |
| Stock at/below reorder point | Low-stock alert table                | All org admins |

Emails are always **fire-and-forget** — a failed SMTP delivery never affects the API response. Jobs retry up to 4 times with exponential backoff (5s → 10s → 20s → 40s).

---

## 🛠️ Local Development

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- Redis 7+

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd tsacademy-capstone-project
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — fill in DB/Redis/JWT/SMTP values

# 3. Run DB migrations and generate Prisma client
npx prisma migrate dev --name init --schema=./prisma/schema
npx prisma generate --schema=./prisma/schema

# 4. Start dev server (hot-reload)
npm run dev
```

Server starts at `http://localhost:5000`  
API docs at `http://localhost:5000/api/v1/docs`

---

## 🐳 Docker Deployment

The entire stack (PostgreSQL + Redis + API + auto-migration) spins up with one command:

```bash
# 1. Configure environment
cp .env.example .env
# Fill in JWT secrets and SMTP credentials — everything else has safe defaults

# 2. Start all services
docker-compose up --build

# Background mode
docker-compose up --build -d

# View API logs
docker-compose logs -f api

# Stop everything (keeps data)
docker-compose down

# Stop and wipe all data volumes
docker-compose down -v
```

### Service ports (default)

| Service    | Port   |
| ---------- | ------ |
| API        | `5000` |
| PostgreSQL | `5432` |
| Redis      | `6379` |

Override any port in `.env` using `API_PORT`, `POSTGRES_PORT`, `REDIS_PORT`.

### Production checklist

- [ ] Generate cryptographically strong JWT secrets (64+ hex chars)
- [ ] Set `SMTP_*` credentials
- [ ] Set `FRONTEND_URL` to your actual frontend origin
- [ ] Put a reverse proxy (nginx/Caddy) in front of the API
- [ ] Enable TLS on the reverse proxy
- [ ] Set `REDIS_PASSWORD` to a strong value
- [ ] Set `POSTGRES_PASSWORD` to a strong value

---

## 🧪 Tests

```bash
# Run all tests (unit + integration)
npm test

# Watch mode during development
npm run test:watch

# With coverage report
npm run test:coverage
```

### Test architecture

All tests run **in-process with mocked infrastructure** — no database, no Redis, no SMTP server needed. The global setup file (`src/__tests__/setup.ts`) installs Jest mocks for Prisma, Redis, the email queue, and the SSE manager before any suite runs.

| Suite            | File                                       | What it tests                                                                                                                                |
| ---------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit — Auth      | `unit/auth/orgAuth.service.test.ts`        | register, login guards (wrong password, inactive account, wrong org)                                                                         |
| Unit — Inventory | `unit/inventory/inventory.service.test.ts` | categories CRUD, stock adjustment (deduction, negative stock guard, archived product guard, SSE broadcast)                                   |
| Unit — Sales     | `unit/sales/sales.service.test.ts`         | createSale (price snapshot, discount validation), approveSale (stock deduction, SSE + email), cancelSale (stock return), summary aggregation |
| Integration      | `integration/app.test.ts`                  | Health check, 404 handler, Zod validation on registration, auth guard (401/403), org access guard, RBAC enforcement                          |

---

## 🔑 Environment Variables

| Variable                    | Required | Description                                                  |
| --------------------------- | -------- | ------------------------------------------------------------ |
| `DATABASE_URL`              | ✅       | PostgreSQL connection string                                 |
| `REDIS_URL`                 | ✅       | Redis connection string                                      |
| `ORG_JWT_SECRET`            | ✅       | 32+ char secret for org access tokens                        |
| `ORG_JWT_REFRESH_SECRET`    | ✅       | 32+ char secret for org refresh tokens                       |
| `SYSTEM_JWT_SECRET`         | ✅       | 32+ char secret for system access tokens                     |
| `SYSTEM_JWT_REFRESH_SECRET` | ✅       | 32+ char secret for system refresh tokens                    |
| `SMTP_HOST`                 | ✅       | SMTP server hostname                                         |
| `SMTP_USER`                 | ✅       | SMTP authentication username                                 |
| `SMTP_PASS`                 | ✅       | SMTP authentication password                                 |
| `NODE_ENV`                  | —        | `development` \| `production` \| `test`                      |
| `PORT`                      | —        | HTTP port (default: `5000`)                                  |
| `FRONTEND_URL`              | —        | Used in email links (default: `http://localhost:3000`)       |
| `JWT_ACCESS_EXPIRATION`     | —        | Access token TTL (default: `15m`)                            |
| `JWT_REFRESH_EXPIRATION`    | —        | Refresh token TTL (default: `7d`)                            |
| `SMTP_PORT`                 | —        | SMTP port (default: `587`)                                   |
| `SMTP_SECURE`               | —        | `true` for port 465, `false` for STARTTLS (default: `false`) |
| `SMTP_FROM`                 | —        | Sender name + address                                        |

---

## 🧩 Tech Stack

| Layer         | Technology                   | Why                                                      |
| ------------- | ---------------------------- | -------------------------------------------------------- |
| Runtime       | Node.js 22 LTS               | LTS stability, native ESM                                |
| Language      | TypeScript 5.9               | End-to-end type safety                                   |
| Framework     | Express 5                    | Mature, minimal, async-native in v5                      |
| ORM           | Prisma 7 + pg Driver Adapter | Multi-file schema, Decimal precision, typed queries      |
| Database      | PostgreSQL 16                | ACID transactions, row-level locking                     |
| Cache / Queue | Redis 7                      | Token blacklist, product cache, BullMQ persistence       |
| Job Queue     | BullMQ 5                     | Reliable at-least-once delivery with exponential backoff |
| Email         | Nodemailer 6                 | SMTP-agnostic, works with any provider                   |
| Real-time     | SSE (built-in)               | Server-to-client push without WebSocket overhead         |
| Logging       | Pino 10                      | Structured JSON logging, minimal overhead                |
| Validation    | Zod 4                        | Runtime schema validation with full TypeScript inference |
| Testing       | Jest 30 + Supertest          | Unit + HTTP integration tests with mocked infrastructure |
| Docs          | Swagger UI + OpenAPI 3.0     | Browsable, try-it-out API documentation                  |

---

## Contibutors
Levi John Favour
Aboh James Ebim

## 📄 License

ISC
