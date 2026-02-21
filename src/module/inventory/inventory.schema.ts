import { z } from "zod";

// ─── Shared params ────────────────────────────────────────────────────────────

export const orgSlugParam = z.object({
  params: z.object({ orgSlug: z.string().min(2) }),
});

export const productParamSchema = z.object({
  params: z.object({
    orgSlug: z.string().min(2),
    productId: z.string().uuid("Invalid product ID"),
  }),
});

export const categoryParamSchema = z.object({
  params: z.object({
    orgSlug: z.string().min(2),
    categoryId: z.string().uuid("Invalid category ID"),
  }),
});

// ─── Category ─────────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  params: z.object({ orgSlug: z.string().min(2) }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Category name must be at least 2 characters"),
    description: z.string().trim().optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    orgSlug: z.string().min(2),
    categoryId: z.string().uuid(),
  }),
  body: z
    .object({
      name: z.string().trim().min(2).optional(),
      description: z.string().trim().optional().nullable(),
    })
    .strict(),
});

// ─── Product ──────────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  params: z.object({ orgSlug: z.string().min(2) }),
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Product name must be at least 2 characters"),
    description: z.string().trim().optional(),
    sku: z.string().trim().min(1, "SKU is required").toUpperCase(),
    categoryId: z.string().uuid("Invalid category ID").optional(),
    costPrice: z.number().positive("Cost price must be positive"),
    sellingPrice: z.number().positive("Selling price must be positive"),
    initialStock: z.number().int().nonnegative().default(0),
    reorderPoint: z.number().int().nonnegative().optional(),
    unit: z.string().trim().default("units"),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    orgSlug: z.string().min(2),
    productId: z.string().uuid(),
  }),
  body: z
    .object({
      name: z.string().trim().min(2).optional(),
      description: z.string().trim().optional().nullable(),
      categoryId: z.string().uuid().optional().nullable(),
      costPrice: z.number().positive().optional(),
      sellingPrice: z.number().positive().optional(),
      reorderPoint: z.number().int().nonnegative().optional().nullable(),
      unit: z.string().trim().optional(),
    })
    .strict(),
});

export const listProductsSchema = z.object({
  params: z.object({ orgSlug: z.string().min(2) }),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().trim().optional(),
    categoryId: z.string().uuid().optional(),
    isArchived: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    lowStockOnly: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    sortBy: z
      .enum(["name", "stockLevel", "sellingPrice", "createdAt"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

// ─── Stock Adjustment ─────────────────────────────────────────────────────────

export const stockAdjustmentSchema = z.object({
  params: z.object({
    orgSlug: z.string().min(2),
    productId: z.string().uuid(),
  }),
  body: z.object({
    type: z.enum(["IN", "OUT"]),
    quantity: z
      .number()
      .int("Quantity must be a whole number")
      .positive("Quantity must be greater than zero"),
    reason: z
      .string()
      .trim()
      .min(3, "A reason of at least 3 characters is required"),
    referenceId: z.string().trim().optional(),
  }),
});

// ─── Forecasting ─────────────────────────────────────────────────────────────

export const forecastQuerySchema = z.object({
  params: z.object({ orgSlug: z.string().min(2) }),
  query: z.object({
    windowDays: z.coerce.number().int().positive().max(365).default(30),
    lowStockOnly: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
  }),
});

export const movementHistorySchema = z.object({
  params: z.object({
    orgSlug: z.string().min(2),
    productId: z.string().uuid(),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    type: z.enum(["IN", "OUT"]).optional(),
  }),
});

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type CreateCategoryDTO = z.infer<typeof createCategorySchema>["body"];
export type UpdateCategoryDTO = z.infer<typeof updateCategorySchema>["body"];
export type CreateProductDTO = z.infer<typeof createProductSchema>["body"];
export type UpdateProductDTO = z.infer<typeof updateProductSchema>["body"];
export type ListProductsQueryDTO = z.infer<typeof listProductsSchema>["query"];
export type StockAdjustmentDTO = z.infer<typeof stockAdjustmentSchema>["body"];
export type ForecastQueryDTO = z.infer<typeof forecastQuerySchema>["query"];
export type MovementHistoryQueryDTO = z.infer<
  typeof movementHistorySchema
>["query"];
