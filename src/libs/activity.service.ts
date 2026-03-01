import type { Request } from "express";
import prisma from "@/config/prisma.js";
import { logger } from "@/libs/logger.js";
import type { Prisma } from "@/generated/prisma/index.js";

export const ActivityAction = {
    // Auth
    LOGIN: "LOGIN",
    LOGOUT: "LOGOUT",
    LOGOUT_ALL: "LOGOUT_ALL",
    PASSWORD_CHANGED: "PASSWORD_CHANGED",
    PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",

    // User management
    USER_CREATED: "USER_CREATED",
    USER_UPDATED: "USER_UPDATED",
    USER_DEACTIVATED: "USER_DEACTIVATED",
    USER_REACTIVATED: "USER_REACTIVATED",
    USER_DELETED: "USER_DELETED",
    USER_ROLE_CHANGED: "USER_ROLE_CHANGED",

    // Org management (system-level)
    ORG_CREATED: "ORG_CREATED",
    ORG_UPDATED: "ORG_UPDATED",
    ORG_DEACTIVATED: "ORG_DEACTIVATED",
    ORG_REACTIVATED: "ORG_REACTIVATED",

    // Inventory
    PRODUCT_CREATED: "PRODUCT_CREATED",
    PRODUCT_UPDATED: "PRODUCT_UPDATED",
    PRODUCT_DELETED: "PRODUCT_DELETED",
    STOCK_ADJUSTED: "STOCK_ADJUSTED",
    PRICE_CHANGED: "PRICE_CHANGED",

    // Sales
    SALE_CREATED: "SALE_CREATED",
    SALE_APPROVED: "SALE_APPROVED",
    SALE_COMPLETED: "SALE_COMPLETED",
    SALE_CANCELLED: "SALE_CANCELLED",
} as const;

export type ActivityActionType =
    (typeof ActivityAction)[keyof typeof ActivityAction];

export interface LogActivityParams {
    userId: string;
    action: ActivityActionType;
    metadata?: Prisma.InputJsonValue;
    req?: Request;
}

export class ActivityService {
    static log(params: LogActivityParams): void {
        const { userId, action, metadata, req } = params;

        // Non-blocking: intentionally not awaited
        prisma.userActivity
            .create({
                data: {
                    orgUserId: userId,
                    action,
                    metadata: metadata ?? undefined,
                    ipAddress: req?.ip ?? undefined,
                    userAgent: req?.headers["user-agent"] ?? undefined,
                },
            })
            .catch((err) => {
                logger.error(
                    { err, userId, action, event: "ACTIVITY_LOG_FAILED" },
                    "Failed to persist user activity",
                );
            });
    }

    static async logAsync(params: LogActivityParams) {
        const { userId, action, metadata, req } = params;

        return prisma.userActivity.create({
            data: {
                orgUserId: userId,
                action,
                metadata: metadata ?? undefined,
                ipAddress: req?.ip ?? undefined,
                userAgent: req?.headers["user-agent"] ?? undefined,
            },
        });
    }
}
