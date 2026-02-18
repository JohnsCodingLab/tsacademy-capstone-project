import type { SystemUser } from "@/generated/prisma/index.js";
import type { SysUserResponseDTO } from "./systemAuth.types.js";
import type {
  LoginSystemUserDTO,
  RegisterSystemUserDTO,
} from "./systemAuth.schema.js";
import prisma from "@/config/prisma.js";
import { AppError } from "@/utils/appError.js";
import { comparePassword, hashPassword } from "@/utils/password.js";
import { SysTokenService } from "../token/sysToken.service.js";
import { logger } from "@/libs/logger.js";
import { TokenService } from "../token/tokenService.js";

export class SysAuthService {
  static async register(data: RegisterSystemUserDTO) {
    const existing = await prisma.systemUser.findUnique({
      where: { email: data.email },
    });
    if (existing) throw new AppError("Email already in use", 409);

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.systemUser.create({
      data: { email: data.email, password: passwordHash, role: "SYSTEM_ADMIN" },
    });

    logger.info(
      { userId: user.id, event: "SYS_USER_CREATED" },
      "System user created",
    );

    return this.sanitize(user);
  }

  static async login(
    data: LoginSystemUserDTO,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await prisma.systemUser.findUnique({
      where: { email: data.email },
    });
    if (!user) throw new AppError("Invalid credentials", 401);

    const isValid = await comparePassword(data.password, user.password);
    if (!isValid) throw new AppError("Invalid credentials", 401);

    if (!user.isActive) throw new AppError("Account disabled", 403);

    await prisma.systemUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = await SysTokenService.issueTokens(user, meta);

    logger.info({ userId: user.id, event: "LOGIN" }, "User logged in");
    return { user: this.sanitize(user), tokens };
  }

  /** Logout single token */
  static async logout(userId: string, refreshToken: string) {
    if (!refreshToken) throw new AppError("Refresh token required", 400);

    const payload = await TokenService.verifyRefreshToken(refreshToken, "ORG");

    if (payload.type !== "SYSTEM") {
      throw new AppError("Invalid token type", 403);
    }

    if (!payload.jti) throw new AppError("Invalid jti", 403);

    await SysTokenService.revokeToken(payload.jti);
    logger.info({ userId, event: "LOGOUT" }, "User logged out");
  }

  /** Logout all devices */
  static async logoutAll(userId: string) {
    await SysTokenService.revokeAllTokens(userId);
    logger.info(
      { userId, event: "LOGOUT_ALL" },
      "User logged out from all devices",
    );
  }

  private static sanitize(user: SystemUser): SysUserResponseDTO {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
