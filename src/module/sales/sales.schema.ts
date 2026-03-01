import { z } from "zod";

// ─── Shared params ────────────────────────────────────────────────────────────

export const saleParamSchema = z.object({
    params: z.object({
        orgSlug: z.string().min(2),
        saleId: z.string().uuid("Invalid sale ID"),
    }),
});

export const orgSlugOnlyParam = z.object({
    params: z.object({ orgSlug: z.string().min(2) }),
});

// ─── Create Sale ──────────────────────────────────────────────────────────────

export const createSaleSchema = z.object({
    params: z.object({ orgSlug: z.string().min(2) }),
    body: z.object({
        items: z
            .array(
                z.object({
                    productId: z.string().uuid("Invalid product ID"),
                    quantity: z
                        .number()
                        .int("Quantity must be a whole number")
                        .positive("Quantity must be greater than zero"),
                    lineDiscount: z.number().nonnegative().default(0),
                }),
            )
            .min(1, "A sale must have at least one item"),
        // Sale-level discount applied after subtotal
        discountAmount: z.number().nonnegative().default(0),
        // Tax applied after discount
        taxRate: z.number().nonnegative().max(100).default(0),
        notes: z.string().trim().max(500).optional(),
    }),
});

// ─── List Sales ───────────────────────────────────────────────────────────────

export const listSalesSchema = z.object({
    params: z.object({ orgSlug: z.string().min(2) }),
    query: z.object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().max(100).optional(),
        status: z
            .enum(["PENDING", "APPROVED", "COMPLETED", "CANCELLED"])
            .optional(),
        createdById: z.string().uuid().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
    }),
});

// ─── Approve Sale ─────────────────────────────────────────────────────────────
// No body required — action is implied by the endpoint

// ─── Cancel Sale ─────────────────────────────────────────────────────────────

export const cancelSaleSchema = z.object({
    params: z.object({
        orgSlug: z.string().min(2),
        saleId: z.string().uuid(),
    }),
    body: z.object({
        cancellationNote: z
            .string()
            .trim()
            .min(3, "Please provide a reason for cancellation"),
    }),
});

// ─── Summary / Reporting ──────────────────────────────────────────────────────

export const salesSummarySchema = z.object({
    params: z.object({ orgSlug: z.string().min(2) }),
    query: z.object({
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        topProductsLimit: z.coerce.number().int().positive().max(20).default(5),
    }),
});

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type CreateSaleDTO = z.infer<typeof createSaleSchema>["body"];
export type ListSalesQueryDTO = z.infer<typeof listSalesSchema>["query"];
export type CancelSaleDTO = z.infer<typeof cancelSaleSchema>["body"];
export type SalesSummaryQueryDTO = z.infer<typeof salesSummarySchema>["query"];
