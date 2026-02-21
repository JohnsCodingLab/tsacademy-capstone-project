import type { Request } from "express";
import type { PaginatedMeta } from "./response.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface PaginationParams {
  page: number; /** Current page number (1-indexed) */
  limit: number; /** Number of records per page */
  skip: number; /** Prisma-compatible skip value */
  take: number; /** Prisma-compatible take value */
}

export const parsePagination = (req: Request): PaginationParams => {
  const rawPage = parseInt(req.query.page as string, 10);
  const rawLimit = parseInt(req.query.limit as string, 10);

  const page = isNaN(rawPage) || rawPage < 1 ? DEFAULT_PAGE : rawPage;
  const limit =
    isNaN(rawLimit) || rawLimit < 1
      ? DEFAULT_LIMIT
      : Math.min(rawLimit, MAX_LIMIT);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  };
};

export const buildPaginationMeta = (
  page: number,
  limit: number,
  total: number,
): PaginatedMeta => {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
