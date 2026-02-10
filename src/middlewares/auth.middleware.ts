import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { AppError } from "@/utils/appError.js";
import { TokenService } from "@/module/auth/token.service.js";

export const authenticate = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Authorization header missing", 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = TokenService.verifyAccessToken(token);
    const user = TokenService.validatePayload(payload);

    // attach to request
    (req as any).user = user;

    next();
  },
);
