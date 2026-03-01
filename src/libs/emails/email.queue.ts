import { Queue } from "bullmq";
import { env } from "@/config/env.js";
import { logger } from "@/libs/logger.js";

// ─── Job type registry ────────────────────────────────────────────────────────
// Keeps job names and payloads co-located and type-safe.

export type EmailJobName =
    | "send:welcome"
    | "send:password-changed"
    | "send:low-stock"
    | "send:sale-approved";

export interface EmailJobMap {
    "send:welcome": {
        to: string;
        recipientName: string;
        organizationName: string;
        email: string;
        temporaryPassword: string;
        loginUrl: string;
        role: string;
    };
    "send:password-changed": {
        to: string;
        recipientName: string;
        ipAddress: string;
        timestamp: string;
        loginUrl: string;
    };
    "send:low-stock": {
        to: string[]; // all admin emails for this org
        organizationName: string;
        products: Array<{
            name: string;
            sku: string;
            currentStock: number;
            reorderPoint: number;
            unit: string;
        }>;
        alertsUrl: string;
    };
    "send:sale-approved": {
        to: string;
        recipientName: string;
        saleId: string;
        totalAmount: number;
        itemCount: number;
        approvedByName: string;
        currency: string;
        saleUrl: string;
    };
}

// ─── Queue ────────────────────────────────────────────────────────────────────

const EMAIL_QUEUE_NAME = "email";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
    connection: { url: env.REDIS_URL },
    defaultJobOptions: {
        attempts: 4,
        backoff: {
            type: "exponential",
            delay: 5_000, // 5s → 10s → 20s → 40s
        },
        removeOnComplete: { count: 100 }, // keep last 100 completed jobs for debugging
        removeOnFail: { count: 500 }, // keep failed jobs longer for inspection
    },
});

// ─── Typed enqueue helper ─────────────────────────────────────────────────────

/**
 * Enqueue an email job. Always fire-and-forget — never await in a controller.
 *
 * @example
 * enqueueEmail("send:welcome", { to: user.email, ... });
 */
export function enqueueEmail<K extends EmailJobName>(
    name: K,
    data: EmailJobMap[K],
): void {
    emailQueue.add(name, data).catch((err) => {
        logger.error(
            { err, jobName: name, event: "EMAIL_ENQUEUE_FAILED" },
            "Failed to enqueue email job — email will not be sent",
        );
    });
}
