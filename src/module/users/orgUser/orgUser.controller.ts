import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { sendSuccess } from "@/utils/response.js";
import { OrgUsersService } from "./orgUser.service.js";
import { ActivityService, ActivityAction } from "@/libs/activity.service.js";
import type {
    CreateOrgUserDTO,
    UpdateOrgUserDTO,
    ChangePasswordDTO,
    ListOrgUsersQueryDTO,
} from "./orgUser.schema.js";
import type { OrgRole } from "@/generated/prisma/index.js";
import type { OrgUserParams } from "@/types/types.js";
import { enqueueEmail } from "@/libs/emails/email.queue.js";
import { env } from "@/config/env.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely extract typed OrgRole from req.user (already narrowed via middleware) */
const getCallerOrgContext = (req: Request) => {
    if (req.user?.type !== "ORG") {
        throw new Error("Expected ORG user context");
    }
    return { callerId: req.user.id, callerRole: req.user.role as OrgRole };
};

// ─── User Management ──────────────────────────────────────────────────────────

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
    const { callerId, callerRole } = getCallerOrgContext(req);
    const result = await OrgUsersService.listUsers(
        req.org!.id,
        req.query as unknown as ListOrgUsersQueryDTO,
        req,
        callerId,
        callerRole,
    );
    sendSuccess(res, result.data, 200, "Users fetched", result.meta);
});

export const getUser = asyncHandler(
    async (req: Request<OrgUserParams>, res: Response) => {
        const { callerId, callerRole } = getCallerOrgContext(req);
        const user = await OrgUsersService.getUser(
            req.org!.id,
            req.params.userId,
            callerId,
            callerRole,
        );
        sendSuccess(res, { user }, 200);
    },
);

export const createUser = asyncHandler(async (req: Request, res: Response) => {
    const { callerId, callerRole } = getCallerOrgContext(req);
    const body = req.body as CreateOrgUserDTO;

    const user = await OrgUsersService.createUser(
        req.org!.id,
        req.body as CreateOrgUserDTO,
        callerId,
        callerRole,
    );

    ActivityService.log({
        userId: callerId,
        action: ActivityAction.USER_CREATED,
        metadata: { newUserId: user.id, role: user.role },
        req,
    });

    // ── Welcome email
    enqueueEmail("send:welcome", {
        to: user.email,
        recipientName: user.name,
        organizationName: req.org!.name,
        email: user.email,
        temporaryPassword: body.password, // plain-text only used here; never stored
        loginUrl: `${env.FRONTEND_URL}/login`,
        role: user.role,
    });

    sendSuccess(res, { user }, 201, "User created successfully");
});

export const updateUser = asyncHandler(
    async (req: Request<OrgUserParams>, res: Response) => {
        const { callerId, callerRole } = getCallerOrgContext(req);
        const user = await OrgUsersService.updateUser(
            req.org!.id,
            req.params.userId,
            req.body as UpdateOrgUserDTO,
            callerId,
            callerRole,
        );

        ActivityService.log({
            userId: callerId,
            action: ActivityAction.USER_UPDATED,
            metadata: { targetUserId: req.params.userId, changes: req.body },
            req,
        });

        sendSuccess(res, { user }, 200, "User updated successfully");
    },
);

export const deactivateUser = asyncHandler(
    async (req: Request<OrgUserParams>, res: Response) => {
        const { callerId, callerRole } = getCallerOrgContext(req);
        await OrgUsersService.deactivateUser(
            req.org!.id,
            req.params.userId,
            callerId,
            callerRole,
        );

        ActivityService.log({
            userId: callerId,
            action: ActivityAction.USER_DEACTIVATED,
            metadata: { targetUserId: req.params.userId },
            req,
        });

        sendSuccess(res, null, 200, "User deactivated successfully");
    },
);

export const reactivateUser = asyncHandler(
    async (req: Request<OrgUserParams>, res: Response) => {
        const { callerId, callerRole } = getCallerOrgContext(req);
        await OrgUsersService.reactivateUser(
            req.org!.id,
            req.params.userId,
            callerId,
            callerRole,
        );

        ActivityService.log({
            userId: callerId,
            action: ActivityAction.USER_REACTIVATED,
            metadata: { targetUserId: req.params.userId },
            req,
        });

        sendSuccess(res, null, 200, "User reactivated successfully");
    },
);

export const deleteUser = asyncHandler(
    async (req: Request<OrgUserParams>, res: Response) => {
        const { callerId } = getCallerOrgContext(req);
        await OrgUsersService.deleteUser(
            req.org!.id,
            req.params.userId,
            callerId,
        );

        ActivityService.log({
            userId: callerId,
            action: ActivityAction.USER_DELETED,
            metadata: { targetUserId: req.params.userId },
            req,
        });

        sendSuccess(res, null, 200, "User permanently deleted");
    },
);

export const getUserActivity = asyncHandler(
    async (req: Request<OrgUserParams>, res: Response) => {
        const { callerId, callerRole } = getCallerOrgContext(req);
        const result = await OrgUsersService.getUserActivity(
            req.org!.id,
            req.params.userId,
            callerId,
            callerRole,
            req,
        );
        sendSuccess(res, result.data, 200, "Activity fetched", result.meta);
    },
);

// ─── Self (Me) Actions ────────────────────────────────────────────────────────

export const getMe = asyncHandler(async (req: Request, res: Response) => {
    const user = await OrgUsersService.getMe(req.user!.id);
    sendSuccess(res, { user }, 200);
});

export const changePassword = asyncHandler(
    async (req: Request, res: Response) => {
        const user = await OrgUsersService.getMe(req.user!.id);
        await OrgUsersService.changePassword(
            req.user!.id,
            req.body as ChangePasswordDTO,
        );

        ActivityService.log({
            userId: req.user!.id,
            action: ActivityAction.PASSWORD_CHANGED,
            metadata: { triggeredBy: "self" },
            req,
        });

        // ── Security alert email ──────────────────────────────────────────────────────
        enqueueEmail("send:password-changed", {
            to: user.email,
            recipientName: user.name,
            ipAddress: req.ip ?? "Unknown",
            timestamp:
                new Date().toLocaleString("en-US", { timeZone: "UTC" }) +
                " UTC",
            loginUrl: `${env.FRONTEND_URL}/login`,
        });

        sendSuccess(
            res,
            null,
            200,
            "Password changed. Please log in again on all devices.",
        );
    },
);
