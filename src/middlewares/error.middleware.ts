import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError.js";
import { logger } from "../libs/logger.js";

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
    });
  }

  logger.error(err);

  res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
};
