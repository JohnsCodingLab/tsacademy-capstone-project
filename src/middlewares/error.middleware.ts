import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError.js";
import { logger } from "../libs/logger.js";
import { sendError } from "@/utils/response.js";

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    logger.warn(
      {
        statusCode: err.statusCode,
        message: err.message,
        url: req.originalUrl,
      },
      "Operational error",
    );
    return sendError(res, err.message, err.statusCode);
  }

  // Unexpected errors — log the full stack for debugging
  logger.error({ err, url: req.originalUrl }, "Unhandled server error");

  sendError(res, "Internal server error", 500);
};
