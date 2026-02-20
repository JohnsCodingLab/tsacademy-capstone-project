import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { AppError } from "@/utils/appError.js";
import { TokenService } from "@/module/auth/token/tokenService.js";
import { logger } from "@/libs/logger.js";
import type { OrgRole } from "@/generated/prisma/index.js";

export const authenticate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authorization header missing", 401);
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = TokenService.decodeWithoutVerification(token);

      if (!decoded || !decoded?.type) {
        throw new AppError("Invalid token format", 401);
      }

      const payload = TokenService.verifyAccessToken(token, decoded.type);

      if (payload.type === "SYSTEM") {
        req.user = {
          id: payload.sub,
          type: "SYSTEM",
          role: "SYSTEM_ADMIN",
        };
      } else if (payload.type === "ORG") {
        req.user = {
          id: payload.sub,
          type: "ORG",
          role: payload.role as OrgRole,
          orgId: payload.orgId!,
        };
      } else {
        throw new AppError("Invalid token type", 401);
      }

      next();
    } catch (error: any) {
      logger.error({ error: error.message }, "Authentication Failed");
      throw new AppError(error.message || "Invalid token", 401);
    }
  },
);
