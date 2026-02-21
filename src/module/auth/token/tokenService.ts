import jwt, { type SignOptions } from "jsonwebtoken";
import { randomUUID } from "crypto";
import { env } from "@/config/env.js";
import prisma from "@/config/prisma.js";
import { redis } from "@/config/redis.js";
import { logger } from "@/libs/logger.js";
import { AppError } from "@/utils/appError.js";
import { hashPassword, comparePassword } from "@/utils/password.js";
import ms, { type StringValue } from "ms";
import type { TokenPayload, UserType } from "./token.types.js";

const CONFIG = {
  SYSTEM: {
    secret: env.SYSTEM_JWT_SECRET,
    refreshSecret: env.SYSTEM_JWT_REFRESH_SECRET,
    model: prisma.sysRefreshToken,
  },
  ORG: {
    secret: env.ORG_JWT_SECRET,
    refreshSecret: env.ORG_JWT_REFRESH_SECRET,
    model: prisma.orgRefreshToken,
  },
};

export class TokenService {
  //  Generate Refresh Token
  static generateAccessToken(payload: TokenPayload): string {
    const config = CONFIG[payload.type];
    return jwt.sign(payload, config.secret, {
      expiresIn: env.JWT_ACCESS_EXPIRATION,
    } as SignOptions);
  }

  //  Generate Refresh Token
  static generateRefreshToken(payload: TokenPayload) {
    const jti = randomUUID();
    const config = CONFIG[payload.type];

    const refreshToken = jwt.sign({ ...payload, jti }, config.refreshSecret, {
      expiresIn: env.JWT_REFRESH_EXPIRATION,
    } as SignOptions);

    return { refreshToken, jti };
  }

  /**
   * Universal Save Refresh Token
   * Uses a dynamic model reference based on user type
   */
  static async saveRefreshToken(params: {
    token: string;
    userId: string;
    jti: string;
    type: UserType;
    meta?: { ipAddress?: string; userAgent?: string };
  }) {
    const { token, userId, jti, type, meta } = params;
    const config = CONFIG[type];
    const tokenHash = await hashPassword(token);
    const expiresAt = new Date(
      Date.now() + ms(env.JWT_REFRESH_EXPIRATION as StringValue),
    );

    // Dynamic data mapping: System uses 'userId', Org uses 'orgUserId'
    const baseData: any = { jti, tokenHash, expiresAt, ...meta };
    if (type === "SYSTEM") {
      await (config.model as any).create({
        data: {
          ...baseData,
          user: {
            connect: { id: userId },
          },
        },
      });
    } else {
      await (config.model as any).create({
        data: {
          ...baseData,
          user: {
            connect: { id: userId },
          },
        },
      });
    }

    logger.info(
      { userId, jti, type, event: "TOKEN_ISSUED" },
      "Refresh token stored",
    );
  }

  //   Universal verify AccessToken
  static verifyAccessToken(token: string, type: UserType) {
    const config = CONFIG[type];
    try {
      const decoded = jwt.verify(token, config.secret) as TokenPayload;

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

  /**
   * Universal Verify Refresh Token
   */
  static async verifyRefreshToken(token: string, type: UserType) {
    const config = CONFIG[type];
    try {
      const payload = jwt.verify(token, config.refreshSecret) as TokenPayload;

      // 1. Redis Blacklist Check
      const isRevoked = await redis.get(`bl_${payload.jti}`);
      if (isRevoked) throw new AppError("Token revoked", 401);

      // 2. DB Check
      const stored = await (config.model as any).findUnique({
        where: { jti: payload.jti },
      });

      if (!stored || !(await comparePassword(token, stored.tokenHash))) {
        throw new AppError("Invalid refresh token", 401);
      }

      return payload;
    } catch (error) {
      throw new AppError("Invalid or expired refresh token", 401);
    }
  }

  /**
   * Peek at the token payload without checking the signature.
   * Useful for identifying token type (SYSTEM vs ORG) in middleware.
   */
  static decodeWithoutVerification(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch (err) {
      return null;
    }
  }

  /**
   * Revoke Token (Redis + DB)
   */
  static async revokeToken(jti: string, type: UserType) {
    const config = CONFIG[type];
    await redis.set(`bl_${jti}`, "1", "EX", 7 * 24 * 60 * 60);
    await (config.model as any).delete({ where: { jti } }).catch(() => {});
  }

  //  Revoke all user tokens
  static async revokeAllUserTokens(userId: string, type: UserType) {
    const config = CONFIG[type];
    const userField = type === "SYSTEM" ? "sysUserId" : "orgUserId";

    const tokens = await (config.model as any).findMany({
      where: { [userField]: userId },
      select: { jti: true },
    });

    if (tokens.length === 0) return;

    const pipeline = redis.multi();

    tokens.forEach((t: { jti: string }) => {
      pipeline.set(`bl_${t.jti}`, "1", "EX", 7 * 24 * 60 * 60);
    });

    await pipeline.exec();

    await (config.model as any).deleteMany({
      where: { [userField]: userId },
    });

    logger.info(
      {
        userId,
        type,
        count: tokens.length,
        event: "ALL_REFRESH_TOKENS_REVOKED",
      },
      "All active sessions revoked",
    );
  }
}
