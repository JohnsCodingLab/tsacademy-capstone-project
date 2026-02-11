import type { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/appError.js";

/**
 * A generic authorization middleware that works for any role type.
 * T is a generic that will represent either OrgRole or SystemRole.
 */
export const authorize = <T extends string>(...allowedRoles: T[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return next(new AppError("Authentication required", 401));
    }

    if (!allowedRoles.includes(user.role as unknown as T)) {
      return next(
        new AppError("Forbidden: You do not have sufficient privileges", 403),
      );
    }

    next();
  };
};
