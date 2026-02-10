import { AppError } from "@/utils/appError.js";
import type { LoginUserDTO, RegisterUserDTO } from "./auth.schema.js";
import prisma from "@/config/prisma.js";
import { comparePassword, hashPassword } from "@/utils/password.js";
import type { UserResponseDTO } from "./auth.types.js";
import { TokenService } from "./token.service.js";
import { logger } from "@/libs/logger.js";

export class AuthService {
  // Register User
  static async register(data: RegisterUserDTO) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError("Email already in use", 409);
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: passwordHash,
        role: data.role,
      },
    });
    logger.info(
      { userId: user.id, event: "USER_REGISTERED" },
      "User registration successful",
    );

    return this.sanitize(user);
  }

  //   Login
  static async login(
    data: LoginUserDTO,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    const isValid = await comparePassword(data.password, user.password);
    if (!isValid) {
      throw new AppError("Invalid credentials", 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const tokens = await this.issueTokens(user.id, user.role, meta);

    logger.info({ userId: user.id, event: "LOGIN" }, "User logged in");
    return { user: this.sanitize(user), tokens };
  }

  /** Logout single token */
  static async logout(userId: string, jti: string) {
    await TokenService.revokeRefreshToken(jti, userId);
    logger.info({ userId, jti, event: "LOGOUT" }, "User logged out");
  }

  /** Logout all devices */
  static async logoutAll(userId: string) {
    await TokenService.revokeAllUserTokens(userId);
    logger.info(
      { userId, event: "LOGOUT_ALL" },
      "User logged out from all devices",
    );
  }

  private static async issueTokens(
    userId: string,
    role: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const accessToken = TokenService.generateAccessToken(userId, role);
    const { refreshToken, jti } = TokenService.generateRefreshToken(
      userId,
      role,
    );

    await TokenService.saveRefreshToken(refreshToken, userId, jti, meta);

    return { accessToken, refreshToken };
  }

  private static sanitize(user: any): UserResponseDTO {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
