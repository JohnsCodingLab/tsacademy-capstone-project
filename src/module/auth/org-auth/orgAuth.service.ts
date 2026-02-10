import prisma from "@/config/prisma.js";
import type { LoginOrgUserDTO, RegisterOrgUserDTO } from "./orgAuth.schema.js";
import { comparePassword, hashPassword } from "@/utils/password.js";
import { logger } from "@/libs/logger.js";
import { OrgTokenService } from "../token/orgToken.service.js";
import type { OrgUser } from "@/generated/prisma/index.js";
import type { OrgUserResponseDTO } from "./orgAuth.types.js";
import slugify from "slugify";
import { AppError } from "@/utils/appError.js";

export class OrgAuthService {
  // Register Organization
  static async registerOrg(data: RegisterOrgUserDTO) {
    return prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: data.organizationName,
          slug: slugify.default(data.organizationName, {
            lower: true,
            strict: true,
          }),
        },
      });

      const passwordHash = await hashPassword(data.password);

      const user = await tx.orgUser.create({
        data: {
          organizationId: org.id,
          name: data.name,
          email: data.email,
          password: passwordHash,
          role: "ORG_SUPER_ADMIN",
        },
      });

      logger.info(
        { orgId: org.id, userId: user.id, event: "ORG_CREATED" },
        "Organization created",
      );

      // const tokens = await this.issueTokens(user);

      return this.sanitize(user);
    });
  }

  //   Login
  static async login(
    data: LoginOrgUserDTO,
    orgSlug: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });
    if (!org || !org.isActive)
      throw new AppError("Organization not found", 404);

    const user = await prisma.orgUser.findUnique({
      where: {
        organizationId_email: {
          organizationId: org.id,
          email: data.email,
        },
      },
    });
    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    const isValid = await comparePassword(data.password, user.password);
    if (!isValid) {
      throw new AppError("Invalid credentials", 401);
    }

    if (!user.isActive || user.revokedAt) {
      throw new AppError("Account disabled", 403);
    }

    await prisma.orgUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = await this.issueTokens(user, meta);

    logger.info({ userId: user.id, event: "LOGIN" }, "User logged in");
    return { user: this.sanitize(user), tokens };
  }

  /** Logout single token */
  static async logout(userId: string, jti: string) {
    await OrgTokenService.revokeRefreshToken(jti, userId);
    logger.info({ userId, jti, event: "LOGOUT" }, "User logged out");
  }

  /** Logout all devices */
  static async logoutAll(userId: string) {
    await OrgTokenService.revokeAllUserTokens(userId);
    logger.info(
      { userId, event: "LOGOUT_ALL" },
      "User logged out from all devices",
    );
  }

  private static async issueTokens(
    user: OrgUser,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const accessToken = OrgTokenService.generateAccessToken(user);
    const { refreshToken, jti } = OrgTokenService.generateRefreshToken(user);

    await OrgTokenService.saveRefreshToken(refreshToken, user.id, jti, meta);

    return { accessToken, refreshToken };
  }

  private static sanitize(user: OrgUser): OrgUserResponseDTO {
    return {
      id: user.id,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImgUrl: user.profileImageUrl,
      isActive: user.isActive,
      revokedAt: user.revokedAt,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
