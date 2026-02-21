import prisma from "@/config/prisma.js";
import { AppError } from "@/utils/appError.js";
import { logger } from "@/libs/logger.js";
import { parsePagination, buildPaginationMeta } from "@/utils/pagination.js";
import type { Request } from "express";
import {
  OrgRole,
  type Organization,
  type OrgUser,
  type SystemUser,
} from "@/generated/prisma/index.js";
import type {
  ListOrgsQueryDTO,
  ListSysUsersQueryDTO,
} from "./systemUser.schema.js";
import type {
  OrgDetailDTO,
  OrgSummaryDTO,
  SysUserListItemDTO,
} from "./systemUser.types.js";

export class SysUsersService {
  // ─── Organization Actions ───────────────────────────────────────────────────

  /**
   * List all organizations with optional filtering and pagination.
   */
  static async listOrgs(query: ListOrgsQueryDTO, req: Request) {
    const { page, limit, skip, take } = parsePagination(req);
    const { isActive, search } = query;

    const where = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        name: { contains: search, mode: "insensitive" as const },
      }),
    };

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { users: true } } },
      }),
      prisma.organization.count({ where }),
    ]);

    const data = orgs.map((org) =>
      this.sanitizeOrgSummary(org, org._count.users),
    );
    const meta = buildPaginationMeta(page, limit, total);

    return { data, meta };
  }

  /**
   * Get a single organization with its full user list.
   */
  static async getOrg(orgSlug: string): Promise<OrgDetailDTO> {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLogin: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { users: true } },
      },
    });

    if (!org) throw new AppError("Organization not found", 404);

    return {
      ...this.sanitizeOrgSummary(org, org._count.users),
      users: org.users,
    };
  }

  /**
   * Deactivate an organization — also deactivates all its users
   * (soft-disable; no data is deleted).
   */
  static async deactivateOrg(orgSlug: string, actorId: string) {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });
    if (!org) throw new AppError("Organization not found", 404);
    if (!org.isActive)
      throw new AppError("Organization is already inactive", 409);

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: org.id },
        data: { isActive: false },
      }),
      prisma.orgUser.updateMany({
        where: { organizationId: org.id },
        data: { isActive: false, revokedAt: new Date() },
      }),
    ]);

    logger.info(
      { orgId: org.id, actorId, event: "ORG_DEACTIVATED" },
      "Organization deactivated",
    );
  }

  /**
   * Reactivate an organization — restores the org but intentionally does NOT
   * bulk-restore users; admins should selectively reactivate users afterwards.
   */
  static async reactivateOrg(orgSlug: string, actorId: string) {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });
    if (!org) throw new AppError("Organization not found", 404);
    if (org.isActive) throw new AppError("Organization is already active", 409);

    await prisma.$transaction([
      prisma.organization.update({
        where: { id: org.id },
        data: { isActive: true },
      }),
      prisma.orgUser.updateMany({
        where: { organizationId: org.id, role: OrgRole.ORG_SUPER_ADMIN },
        data: { isActive: true, revokedAt: null },
      }),
    ]);

    logger.info(
      { orgId: org.id, actorId, event: "ORG_REACTIVATED" },
      "Organization reactivated",
    );
  }

  // ─── System User Actions ────────────────────────────────────────────────────

  /**
   * List all system users with optional filtering.
   */
  static async listSysUsers(query: ListSysUsersQueryDTO, req: Request) {
    const { page, limit, skip, take } = parsePagination(req);
    const { isActive } = query;

    const where = {
      ...(isActive !== undefined && { isActive }),
    };

    const [users, total] = await Promise.all([
      prisma.systemUser.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
      }),
      prisma.systemUser.count({ where }),
    ]);

    const meta = buildPaginationMeta(page, limit, total);
    return { data: users as SysUserListItemDTO[], meta };
  }

  /**
   * Get a single system user by ID.
   */
  static async getSysUser(userId: string): Promise<SysUserListItemDTO> {
    const user = await prisma.systemUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    if (!user) throw new AppError("System user not found", 404);
    return user as SysUserListItemDTO;
  }

  /**
   * Deactivate a system user account.
   * A system user cannot deactivate themselves.
   */
  static async deactivateSysUser(userId: string, actorId: string) {
    if (userId === actorId) {
      throw new AppError("You cannot deactivate your own account", 400);
    }

    const user = await prisma.systemUser.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("System user not found", 404);
    if (!user.isActive) throw new AppError("User is already inactive", 409);

    await prisma.systemUser.update({
      where: { id: userId },
      data: { isActive: false },
    });

    logger.info(
      { targetUserId: userId, actorId, event: "SYS_USER_DEACTIVATED" },
      "System user deactivated",
    );
  }

  /**
   * Permanently delete a system user.
   * Cannot delete your own account.
   */
  static async deleteSysUser(userId: string, actorId: string) {
    if (userId === actorId) {
      throw new AppError("You cannot delete your own account", 400);
    }

    const user = await prisma.systemUser.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("System user not found", 404);

    await prisma.systemUser.delete({ where: { id: userId } });

    logger.info(
      { targetUserId: userId, actorId, event: "SYS_USER_DELETED" },
      "System user deleted",
    );
  }

  // ─── Private Sanitisers ─────────────────────────────────────────────────────

  private static sanitizeOrgSummary(
    org: Pick<
      Organization,
      "id" | "name" | "slug" | "isActive" | "createdAt" | "updatedAt"
    >,
    userCount: number,
  ): OrgSummaryDTO {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      isActive: org.isActive,
      userCount,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }
}
