import prisma from "@/config/prisma.js";
import { AppError } from "@/utils/appError.js";
import { hashPassword, comparePassword } from "@/utils/password.js";
import { logger } from "@/libs/logger.js";
import { parsePagination, buildPaginationMeta } from "@/utils/pagination.js";
import { TokenService } from "@/module/auth/token/tokenService.js";
import type { Request } from "express";
import type { OrgRole, OrgUser } from "@/generated/prisma/index.js";
import type {
  CreateOrgUserDTO,
  UpdateOrgUserDTO,
  ChangePasswordDTO,
  ListOrgUsersQueryDTO,
} from "./orgUser.schema.js";
import type {
  OrgUserActivityDTO,
  OrgUserResponseDTO,
} from "./orgUser.types.js";

export class OrgUsersService {
  // ─── List Users ─────────────────────────────────────────────────────────────

  /**
   * List users belonging to an org with filtering, search and pagination.
   * ORG_USER callers are restricted to seeing only themselves (enforced here,
   * the controller passes the `callerId` for this check).
   */
  static async listUsers(
    orgId: string,
    query: ListOrgUsersQueryDTO,
    req: Request,
    callerId: string,
    callerRole: OrgRole,
  ) {
    const { page, limit, skip, take } = parsePagination(req);
    const { role, isActive, search } = query;

    // ORG_USER may only see themselves
    if (callerRole === "ORG_USER") {
      const self = await prisma.orgUser.findUnique({
        where: { id: callerId },
        select: this.safeSelect,
      });
      return {
        data: self ? [this.sanitize(self as OrgUser)] : [],
        meta: buildPaginationMeta(1, 1, 1),
      };
    }

    const where = {
      organizationId: orgId,
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.orgUser.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: this.safeSelect,
      }),
      prisma.orgUser.count({ where }),
    ]);

    return {
      data: (users as OrgUser[]).map(this.sanitize),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  // ─── Get Single User ─────────────────────────────────────────────────────────

  /**
   * Get a user's profile.
   * ORG_USER can only view their own profile.
   */
  static async getUser(
    orgId: string,
    targetUserId: string,
    callerId: string,
    callerRole: OrgRole,
  ): Promise<OrgUserResponseDTO> {
    if (callerRole === "ORG_USER" && callerId !== targetUserId) {
      throw new AppError("Forbidden: you can only view your own profile", 403);
    }

    const user = await prisma.orgUser.findFirst({
      where: { id: targetUserId, organizationId: orgId },
      select: this.safeSelect,
    });

    if (!user) throw new AppError("User not found", 404);
    return this.sanitize(user as OrgUser);
  }

  // ─── Create / Invite User ────────────────────────────────────────────────────

  /**
   * Create a new org user.
   * Only ORG_SUPER_ADMIN and ORG_ADMIN can call this.
   * ORG_ADMIN cannot create another ORG_ADMIN or ORG_SUPER_ADMIN.
   */
  static async createUser(
    orgId: string,
    data: CreateOrgUserDTO,
    callerId: string,
    callerRole: OrgRole,
  ): Promise<OrgUserResponseDTO> {
    // ORG_ADMIN can only create ORG_USER
    if (callerRole === "ORG_ADMIN" && data.role !== "ORG_USER") {
      throw new AppError("ORG_ADMIN can only create ORG_USER accounts", 403);
    }

    const existing = await prisma.orgUser.findUnique({
      where: {
        organizationId_email: { organizationId: orgId, email: data.email },
      },
    });
    if (existing)
      throw new AppError("Email already in use in this organization", 409);

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.orgUser.create({
      data: {
        organizationId: orgId,
        name: data.name,
        email: data.email,
        password: passwordHash,
        role: data.role,
      },
      select: this.safeSelect,
    });

    logger.info(
      { userId: user.id, orgId, createdBy: callerId, event: "USER_CREATED" },
      "Org user created",
    );

    return this.sanitize(user as OrgUser);
  }

  // ─── Update User ─────────────────────────────────────────────────────────────

  /**
   * Update a user's profile fields.
   * Role changes are restricted to ORG_SUPER_ADMIN only.
   * ORG_SUPER_ADMIN cannot demote themselves.
   */
  static async updateUser(
    orgId: string,
    targetUserId: string,
    data: UpdateOrgUserDTO,
    callerId: string,
    callerRole: OrgRole,
  ): Promise<OrgUserResponseDTO> {
    const target = await prisma.orgUser.findFirst({
      where: { id: targetUserId, organizationId: orgId },
    });
    if (!target) throw new AppError("User not found", 404);

    // Guard: only ORG_SUPER_ADMIN may change roles
    if (data.role && callerRole !== "ORG_SUPER_ADMIN") {
      throw new AppError("Only ORG_SUPER_ADMIN can change user roles", 403);
    }

    // Guard: ORG_SUPER_ADMIN cannot demote themselves
    if (data.role && callerId === targetUserId) {
      throw new AppError("You cannot change your own role", 400);
    }

    // Guard: ORG_ADMIN cannot edit other admins or super admins
    if (
      callerRole === "ORG_ADMIN" &&
      (target.role === "ORG_ADMIN" || target.role === "ORG_SUPER_ADMIN") &&
      callerId !== targetUserId
    ) {
      throw new AppError(
        "ORG_ADMIN cannot update another admin or super admin",
        403,
      );
    }

    const updated = await prisma.orgUser.update({
      where: { id: targetUserId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.profileImageUrl !== undefined && {
          profileImageUrl: data.profileImageUrl || null,
        }),
        ...(data.role && { role: data.role }),
      },
      select: this.safeSelect,
    });

    logger.info(
      {
        targetUserId,
        updatedBy: callerId,
        changes: data,
        event: "USER_UPDATED",
      },
      "Org user updated",
    );

    return this.sanitize(updated as OrgUser);
  }

  // ─── Deactivate / Reactivate User ────────────────────────────────────────────

  /**
   * Soft-deactivate a user — revokes all their sessions.
   * ORG_SUPER_ADMIN cannot deactivate themselves.
   */
  static async deactivateUser(
    orgId: string,
    targetUserId: string,
    callerId: string,
    callerRole: OrgRole,
  ) {
    if (callerId === targetUserId) {
      throw new AppError("You cannot deactivate your own account", 400);
    }

    const target = await prisma.orgUser.findFirst({
      where: { id: targetUserId, organizationId: orgId },
    });
    if (!target) throw new AppError("User not found", 404);
    if (!target.isActive) throw new AppError("User is already inactive", 409);

    // ORG_ADMIN cannot deactivate another admin or the super admin
    if (
      callerRole === "ORG_ADMIN" &&
      (target.role === "ORG_ADMIN" || target.role === "ORG_SUPER_ADMIN")
    ) {
      throw new AppError(
        "ORG_ADMIN cannot deactivate a peer admin or super admin",
        403,
      );
    }

    await prisma.orgUser.update({
      where: { id: targetUserId },
      data: { isActive: false, revokedAt: new Date() },
    });

    // Revoke all active sessions for this user
    await TokenService.revokeAllUserTokens(targetUserId, "ORG");

    logger.info(
      { targetUserId, deactivatedBy: callerId, event: "USER_DEACTIVATED" },
      "Org user deactivated",
    );
  }

  /**
   * Reactivate a previously deactivated user.
   */
  static async reactivateUser(
    orgId: string,
    targetUserId: string,
    callerId: string,
    callerRole: OrgRole,
  ) {
    const target = await prisma.orgUser.findFirst({
      where: { id: targetUserId, organizationId: orgId },
    });
    if (!target) throw new AppError("User not found", 404);
    if (target.isActive) throw new AppError("User is already active", 409);

    if (
      callerRole === "ORG_ADMIN" &&
      (target.role === "ORG_ADMIN" || target.role === "ORG_SUPER_ADMIN")
    ) {
      throw new AppError(
        "ORG_ADMIN cannot reactivate a peer admin or super admin",
        403,
      );
    }

    await prisma.orgUser.update({
      where: { id: targetUserId },
      data: { isActive: true, revokedAt: null },
    });

    logger.info(
      { targetUserId, reactivatedBy: callerId, event: "USER_REACTIVATED" },
      "Org user reactivated",
    );
  }

  // ─── Delete User ─────────────────────────────────────────────────────────────

  /**
   * Hard-delete a user. ORG_SUPER_ADMIN only.
   * Cannot delete themselves.
   */
  static async deleteUser(
    orgId: string,
    targetUserId: string,
    callerId: string,
  ) {
    if (callerId === targetUserId) {
      throw new AppError("You cannot delete your own account", 400);
    }

    const target = await prisma.orgUser.findFirst({
      where: { id: targetUserId, organizationId: orgId },
    });
    if (!target) throw new AppError("User not found", 404);

    await prisma.orgUser.delete({ where: { id: targetUserId } });

    logger.info(
      { targetUserId, deletedBy: callerId, event: "USER_DELETED" },
      "Org user permanently deleted",
    );
  }

  // ─── Self: Get Own Profile ────────────────────────────────────────────────────

  static async getMe(userId: string): Promise<OrgUserResponseDTO> {
    const user = await prisma.orgUser.findUnique({
      where: { id: userId },
      select: this.safeSelect,
    });
    if (!user) throw new AppError("User not found", 404);
    return this.sanitize(user as OrgUser);
  }

  // ─── Self: Change Password ────────────────────────────────────────────────────

  /**
   * Self-service password change.
   * Revokes ALL existing sessions after success, forcing re-login on all devices.
   */
  static async changePassword(userId: string, data: ChangePasswordDTO) {
    const user = await prisma.orgUser.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found", 404);

    const isValid = await comparePassword(data.currentPassword, user.password);
    if (!isValid) throw new AppError("Current password is incorrect", 401);

    if (data.currentPassword === data.newPassword) {
      throw new AppError(
        "New password must differ from the current password",
        400,
      );
    }

    const newHash = await hashPassword(data.newPassword);

    await prisma.orgUser.update({
      where: { id: userId },
      data: { password: newHash },
    });

    // Invalidate all sessions for security
    await TokenService.revokeAllUserTokens(userId, "ORG");

    logger.info({ userId, event: "PASSWORD_CHANGED" }, "User changed password");
  }

  // ─── Activity Log ─────────────────────────────────────────────────────────────

  /**
   * Get a user's activity history (paginated).
   * ORG_USER can only view their own activity.
   */
  static async getUserActivity(
    orgId: string,
    targetUserId: string,
    callerId: string,
    callerRole: OrgRole,
    req: Request,
  ): Promise<{
    data: OrgUserActivityDTO[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    if (callerRole === "ORG_USER" && callerId !== targetUserId) {
      throw new AppError("Forbidden: you can only view your own activity", 403);
    }

    // Verify target belongs to this org
    const target = await prisma.orgUser.findFirst({
      where: { id: targetUserId, organizationId: orgId },
      select: { id: true },
    });
    if (!target) throw new AppError("User not found", 404);

    const { page, limit, skip, take } = parsePagination(req);

    const [activities, total] = await Promise.all([
      prisma.userActivity.findMany({
        where: { orgUserId: targetUserId },
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      prisma.userActivity.count({ where: { orgUserId: targetUserId } }),
    ]);

    return {
      data: activities as OrgUserActivityDTO[],
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /** Columns to select — password is always excluded */
  private static readonly safeSelect = {
    id: true,
    organizationId: true,
    name: true,
    email: true,
    role: true,
    profileImageUrl: true,
    isActive: true,
    revokedAt: true,
    lastLogin: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  private static sanitize(user: OrgUser): OrgUserResponseDTO {
    return {
      id: user.id,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
      isActive: user.isActive,
      revokedAt: user.revokedAt,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
