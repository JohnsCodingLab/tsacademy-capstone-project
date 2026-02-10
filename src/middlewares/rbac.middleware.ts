import type { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/appError.js";
import type { OrgRole } from "@/generated/prisma/index.js";

export const authorizeOrg =
  (...allowedRoles: OrgRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) throw new AppError("Unauthorized", 401);

    if (!allowedRoles.includes(user.role)) {
      throw new AppError("Forbidden: insufficient privileges", 403);
    }

    next();
  };
