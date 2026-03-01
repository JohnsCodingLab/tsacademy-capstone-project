// src/__tests__/setup.ts
// This file is executed once before all test suites via jest.config.ts setupFilesAfterFramework.
// It installs global mocks so no test ever touches a real database, Redis instance, or SMTP server.

import { jest } from "@jest/globals";

// ─── Mock: Prisma ─────────────────────────────────────────────────────────────
// Replace the entire Prisma client with a jest mock object.
// Each model method is a jest.fn() that tests can override per-suite.

jest.mock("@/config/prisma.js", () => ({
    default: {
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})),
        orgUser: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
        },
        organization: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
        },
        systemUser: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
        },
        product: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            aggregate: jest.fn(),
            groupBy: jest.fn(),
        },
        category: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        stockMovement: {
            findMany: jest.fn(),
            create: jest.fn(),
            count: jest.fn(),
        },
        sale: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            aggregate: jest.fn(),
            groupBy: jest.fn(),
        },
        saleItem: {
            findMany: jest.fn(),
            groupBy: jest.fn(),
        },
        userActivity: {
            create: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
        },
        orgRefreshToken: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
        },
        sysRefreshToken: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
            deleteMany: jest.fn(),
        },
    },
    prisma: {}, // named export alias
}));

// ─── Mock: Redis ──────────────────────────────────────────────────────────────

jest.mock("@/config/redis.js", () => ({
    redis: {
        get: jest.fn<() => Promise<string | null>>(),
        set: jest.fn<() => Promise<unknown>>(),
        del: jest.fn<() => Promise<number>>(),

        // ✅ FIXED
        keys: jest.fn<() => Promise<string[]>>().mockResolvedValue([]),

        multi: jest.fn(() => ({
            set: jest.fn().mockReturnThis(),
            exec: jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]),
        })),

        // ✅ FIXED
        ping: jest.fn<() => Promise<string>>().mockResolvedValue("PONG"),
    },

    connectRedis: jest.fn(),
}));

// ─── Mock: Email Queue ────────────────────────────────────────────────────────

jest.mock("@/libs/email/email.queue.js", () => ({
    enqueueEmail: jest.fn(),
    emailQueue: { add: jest.fn() },
}));

// ─── Mock: SSE Manager ───────────────────────────────────────────────────────

jest.mock("@/libs/sse/sse.manager.js", () => ({
    SSEManager: {
        connect: jest.fn(),
        broadcast: jest.fn(),
        startHeartbeat: jest.fn(),
        stopHeartbeat: jest.fn(),
    },
}));

// ─── Mock: ActivityService ────────────────────────────────────────────────────

jest.mock("@/libs/activity.service.js", () => ({
    ActivityService: { log: jest.fn(), logAsync: jest.fn() },
    ActivityAction: {
        LOGIN: "LOGIN",
        LOGOUT: "LOGOUT",
        PASSWORD_CHANGED: "PASSWORD_CHANGED",
        USER_CREATED: "USER_CREATED",
        USER_UPDATED: "USER_UPDATED",
        USER_DEACTIVATED: "USER_DEACTIVATED",
        USER_REACTIVATED: "USER_REACTIVATED",
        USER_DELETED: "USER_DELETED",
        PRODUCT_CREATED: "PRODUCT_CREATED",
        PRODUCT_UPDATED: "PRODUCT_UPDATED",
        PRODUCT_DELETED: "PRODUCT_DELETED",
        STOCK_ADJUSTED: "STOCK_ADJUSTED",
        SALE_CREATED: "SALE_CREATED",
        SALE_APPROVED: "SALE_APPROVED",
        SALE_COMPLETED: "SALE_COMPLETED",
        SALE_CANCELLED: "SALE_CANCELLED",
    },
}));
