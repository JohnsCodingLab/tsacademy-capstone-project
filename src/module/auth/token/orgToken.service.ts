import { type OrgUser } from "@/generated/prisma/index.js";
import { TokenService } from "./tokenService.js";

export class OrgTokenService {
  static async issueTokens(
    user: OrgUser,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const payload = {
      sub: user.id,
      role: user.role,
      orgId: user.organizationId,
      type: "ORG" as const,
    };

    const accessToken = TokenService.generateAccessToken(payload);
    const { refreshToken, jti } = TokenService.generateRefreshToken(payload);

    await TokenService.saveRefreshToken({
      token: refreshToken,
      userId: user.id,
      jti,
      type: "ORG",
      meta,
    });

    return { accessToken, refreshToken };
  }

  static async revokeToken(jti: string) {
    return TokenService.revokeToken(jti, "ORG");
  }

  static async revokeAllTokens(userId: string) {
    return TokenService.revokeAllUserTokens(userId, "ORG");
  }
}
