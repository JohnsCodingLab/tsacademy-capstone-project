import { env } from "@/config/env.js";
import prisma from "@/config/prisma.js";
import { redis } from "@/config/redis.js";
import { OrgRole, type OrgUser } from "@/generated/prisma/index.js";
import { logger } from "@/libs/logger.js";
import { AppError } from "@/utils/appError.js";
import { comparePassword, hashPassword } from "@/utils/password.js";
import { randomUUID } from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import ms, { type StringValue } from "ms";
import type { ValidatedUser } from "../org-auth/orgAuth.types.js";

export class OrgTokenService {
  // Generate Org access token
  static generateAccessToken(user: OrgUser) {
    return jwt.sign(
      {
        sub: user.id,
        orgId: user.organizationId,
        role: user.role,
        type: "ORG",
      },
      env.ORG_JWT_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRATION } as SignOptions,
    );
  }

  //   Generate refresh token
  static generateRefreshToken(user: OrgUser) {
    const jti = randomUUID();

    const refreshToken = jwt.sign(
      {
        sub: user.id,
        orgId: user.organizationId,
        role: user.role,
        type: "ORG",
        jti,
      },
      env.ORG_JWT_REFRESH_SECRET,
      {
        expiresIn: env.JWT_REFRESH_EXPIRATION,
      } as SignOptions,
    );

    return { refreshToken, jti };
  }

  //   Save refresh token to db
  static async saveRefreshToken(
    token: string,
    orgUserId: string,
    jti: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const tokenHash = await hashPassword(token);

    const expireInMs = ms(env.JWT_REFRESH_EXPIRATION as StringValue);
    const expiresAt = new Date(Date.now() + expireInMs);

    await prisma.refreshToken.create({
      data: {
        jti,
        tokenHash,
        expiresAt,
        orgUserId,
        ...meta,
      },
    });

    logger.info(
      { orgUserId, jti, event: "REFRESH_TOKEN_ISSUED" },
      "Refresh token saved",
    );
  }

  // verify access token
  static verifyAccessToken(token: string) {
    try {
      const decoded = jwt.verify(token, env.ORG_JWT_SECRET) as any;

      if (!decoded.sub || !decoded.role) {
        logger.warn(
          { token, event: "INVALID_ACCESS_TOKEN" },
          "Access token payload invalid",
        );
        throw new AppError("Invalid token payload", 401);
      }

      return decoded;
    } catch (err) {
      logger.warn(
        { token, event: "INVALID_ACCESS_TOKEN" },
        "Access token verification failed",
      );
      throw new AppError("Invalid or expired token", 401);
    }
  }

  //   Verify Refresh Token
  static async verifyRefreshToken(token: string) {
    try {
      const payload = jwt.verify(token, env.ORG_JWT_REFRESH_SECRET) as {
        sub: string;
        jti: string;
      };

      // Check Redis blacklist first
      const isRevoked = await redis.get(`bl_${payload.jti}`);
      if (isRevoked) {
        logger.warn(
          {
            userId: payload.sub,
            jti: payload.jti,
            event: "REVOKED_REFRESH_TOKEN",
          },
          "Refresh token revoked in Redis",
        );
        throw new AppError("Refresh token revoked", 401);
      }

      const stored = await prisma.refreshToken.findUnique({
        where: { jti: payload.jti },
      });

      if (!stored) {
        throw new AppError("Refresh token revoked", 401);
      }

      const valid = await comparePassword(token, stored.tokenHash);
      if (!valid) {
        throw new AppError("Invalid refresh token", 401);
      }

      return payload;
    } catch {
      throw new AppError("Invalid or expired refresh token", 401);
    }
  }

  //   Revoke refresh Token
  static async revokeRefreshToken(jti: string, orgUserId?: string) {
    await redis.set(`bl_${jti}`, "revoked", "EX", 7 * 24 * 60 * 60);
    await prisma.refreshToken.delete({ where: { jti } });
    logger.info(
      { orgUserId, jti, event: "REFRESH_TOKEN_REVOKED" },
      "Refresh token revoked",
    );
  }

  /** Revoke all refresh tokens for a user */
  static async revokeAllUserTokens(orgUserId: string) {
    const tokens = await prisma.refreshToken.findMany({ where: { orgUserId } });

    const pipeline = redis.multi();
    tokens.forEach((t) =>
      pipeline.set(`bl_${t.jti}`, "revoked", "EX", 7 * 24 * 60 * 60),
    );
    await pipeline.exec();

    await prisma.refreshToken.deleteMany({ where: { orgUserId } });

    logger.info(
      { orgUserId, event: "ALL_REFRESH_TOKENS_REVOKED" },
      "All refresh tokens revoked for user",
    );
  }

  /**
   * Validates the raw JWT payload and transforms it into a typed object.
   */
  static validatePayload(payload: any): ValidatedUser {
    if (!payload?.sub || !payload?.role) {
      throw new AppError("Invalid token payload structure", 401);
    }

    const roleValue = payload.role as OrgRole;
    if (!Object.values(OrgRole).includes(roleValue)) {
      throw new AppError("Token contains an unrecognized user role", 403);
    }

    return {
      id: payload.sub,
      role: roleValue,
    };
  }
}
