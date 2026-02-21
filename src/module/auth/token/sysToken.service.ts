import type { SystemUser } from "@/generated/prisma/index.js";
import { TokenService } from "./tokenService.js";

export class SysTokenService {
  static async issueTokens(
    user: SystemUser,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const payload = {
      sub: user.id,
      role: user.role,
      type: "SYSTEM" as const,
    };

    const accessToken = TokenService.generateAccessToken(payload);
    const { refreshToken, jti } = TokenService.generateRefreshToken(payload);

    await TokenService.saveRefreshToken({
      token: refreshToken,
      userId: user.id,
      jti,
      type: "SYSTEM",
      meta,
    });

    return { accessToken, refreshToken };
  }

  static async revokeToken(jti: string) {
    return TokenService.revokeToken(jti, "SYSTEM");
  }

  static async revokeAllTokens(userId: string) {
    return TokenService.revokeAllUserTokens(userId, "SYSTEM");
  }
}
