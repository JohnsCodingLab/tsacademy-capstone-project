import type { Response } from "express";

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface SuccessResponse<T> {
  status: "success";
  message?: string;
  data: T;
  meta?: PaginatedMeta;
}

interface ErrorResponse {
  status: "error";
  message: string;
  errors?: { path: string | number; message: string }[];
}

/**
 * Send a standardised success response.
 *
 * @example
 * sendSuccess(res, { user }, 201, "User created");
 * sendSuccess(res, { users }, 200, "Users fetched", paginatedMeta);
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string,
  meta?: PaginatedMeta,
): void => {
  const body: SuccessResponse<T> = { status: "success", data };
  if (message) body.message = message;
  if (meta) body.meta = meta;
  res.status(statusCode).json(body);
};

/**
 * Send a standardised error response.
 * Prefer using AppError + errorMiddleware for most cases.
 * Use this directly only when you need inline error control.
 *
 * @example
 * sendError(res, "Validation failed", 422, validationErrors);
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  errors?: ErrorResponse["errors"],
): void => {
  const body: ErrorResponse = { status: "error", message };
  if (errors) body.errors = errors;
  res.status(statusCode).json(body);
};
