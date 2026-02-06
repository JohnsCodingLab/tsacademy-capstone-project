# 📦 Smart Inventory & Sales Management System (S.I.S.M.S)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.x-2D3748.svg)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise-grade, high-performance RESTful API designed for modern retail and warehouse environments. Built with a focus on **Data Integrity**, **Predictive Insights**, and **Scalable Architecture**.

---

## 🚀 Key Features

- **🔥 Smart Inventory Forecasting**: Automated calculation of stock depletion dates based on moving average sales velocity.
- **🛡️ Enterprise Security**: JWT-based authentication with **Token Versioning** (instantly invalidates all sessions on password change) and RBAC.
- **📜 Audit Trail System**: Comprehensive logging of every sensitive action (who changed a price, who adjusted stock, etc.).
- **⚡ High-Performance I/O**: Optimized with **Redis** caching, **PostgreSQL** indexing, and **Pino** structured logging.
- **🧩 Modular Architecture**: Uses Prisma 7's multi-file schema for clean domain separation.

---

## 🛠 Tech Stack

| Layer          | Technology                   |
| :------------- | :--------------------------- |
| **Runtime**    | Node.js v22 (LTS)            |
| **Language**   | TypeScript 5.9               |
| **Framework**  | Express.js                   |
| **ORM**        | Prisma 7 (Multi-file Schema) |
| **Database**   | PostgreSQL                   |
| **Caching**    | Redis                        |
| **Logging**    | Pino                         |
| **Validation** | Zod                          |

---

## 📂 Project Structure

The project follows a **Feature-Based Module** pattern for extreme scalability.

```text
src/
├── config/          # DB (Prisma + pg Adapter), Redis & Env configs
├── modules/         # Feature-based domains
│   ├── auth/        # Authentication & Role management
│   ├── inventory/   # Stock levels, Forecasting & Thresholds
│   ├── sales/       # Transactions & Invoicing
│   └── users/       # User management
├── libs/            # Shared logic (Logger, Cache, Queue)
├── middlewares/     # Auth, Error Handling, Rate Limiting
├── utils/           # Global helpers & Constants
├── generated/       # Custom Prisma Client output
└── server.ts        # Entry point


# App Configuration
PORT=5000
NODE_ENV=development

# Database (PostgreSQL)
DATABASE_URL="postgresql://user:password@localhost:5432/smart_inventory?schema=public"

# Redis (Caching)
REDIS_URL="redis://localhost:6379"

# Security (JWT)
JWT_SECRET="your_secure_random_string"
REFRESH_TOKEN_SECRET="another_secure_string"


# Install dependencies
npm install

# Generate the custom Prisma Client
npx prisma generate --schema=./prisma/schema

# Sync the database with your models
npx prisma migrate dev --name init --schema=./prisma/schema

# Build and start all services
docker-compose up --build


# Command Action
npm run dev	Runs the app in development mode with tsx watch.
npm run build	Compiles TypeScript to production JavaScript in /dist.
npm run start	Runs the compiled production build.
```
