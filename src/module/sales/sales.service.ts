import { Decimal } from "@prisma/client/runtime/client.js";
import { SSEManager } from "@/libs/sse/sse.manager.js";
import { enqueueEmail } from "@/libs/emails/email.queue.js";
import { env } from "@/config/env.js";

import prisma from "@/config/prisma.js";
import { AppError } from "@/utils/appError.js";
import { logger } from "@/libs/logger.js";
import { parsePagination, buildPaginationMeta } from "@/utils/pagination.js";
import type { Request } from "express";
import type { Sale, SaleItem, SaleStatus } from "@/generated/prisma/index.js";
import type {
    SaleResponseDTO,
    SaleSummaryDTO,
    SaleItemResponseDTO,
    SalesSummaryDTO,
} from "./sales.types.js";
import type {
    CreateSaleDTO,
    ListSalesQueryDTO,
    CancelSaleDTO,
    SalesSummaryQueryDTO,
} from "./sales.schema.js";

// ─── Sanitiser ────────────────────────────────────────────────────────────────

function sanitizeSale(
    sale: Sale & {
        createdBy: { name: string };
        processedBy: { name: string } | null;
        items: Array<SaleItem & { product: { name: string; sku: string } }>;
    },
): SaleResponseDTO {
    return {
        id: sale.id,
        organizationId: sale.organizationId,
        createdById: sale.createdById,
        createdByName: sale.createdBy.name,
        processedById: sale.processedById,
        processedByName: sale.processedBy?.name ?? null,
        status: sale.status,
        subtotal: Number(sale.subtotal),
        discountAmount: Number(sale.discountAmount),
        taxAmount: Number(sale.taxAmount),
        totalAmount: Number(sale.totalAmount),
        notes: sale.notes,
        approvedAt: sale.approvedAt,
        cancelledAt: sale.cancelledAt,
        cancellationNote: sale.cancellationNote,
        items: sale.items.map(
            (item): SaleItemResponseDTO => ({
                id: item.id,
                productId: item.productId,
                productName: item.product.name,
                productSku: item.product.sku,
                quantity: item.quantity,
                unitPrice: Number(item.unitPrice),
                lineDiscount: Number(item.lineDiscount),
                lineTotal: Number(item.lineTotal),
            }),
        ),
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt,
    };
}

/** Reusable include block for full sale hydration */
const SALE_INCLUDE = {
    createdBy: { select: { name: true } },
    processedBy: { select: { name: true } },
    items: {
        include: {
            product: { select: { name: true, sku: true } },
        },
    },
} as const;

// ─── Service ──────────────────────────────────────────────────────────────────

export class SalesService {
    // ═══════════════════════════════════════════════════════════════════════════
    // CREATE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Create a new PENDING sale.
     *
     * Validates every product exists, is active, and belongs to this org.
     * Captures the current sellingPrice on each line — price changes after
     * this point do NOT affect the sale record.
     *
     * Stock is NOT deducted at creation — only on APPROVE.
     */
    static async createSale(
        orgId: string,
        data: CreateSaleDTO,
        actorId: string,
    ): Promise<SaleResponseDTO> {
        // ── 1. Validate & snapshot all products ──────────────────────────────────
        const productIds = [...new Set(data.items.map((i) => i.productId))];

        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds },
                organizationId: orgId,
                isArchived: false,
            },
        });

        if (products.length !== productIds.length) {
            const foundIds = new Set(products.map((p) => p.id));
            const missing = productIds.filter((id) => !foundIds.has(id));
            throw new AppError(
                `Product(s) not found or archived: ${missing.join(", ")}`,
                404,
            );
        }

        const productMap = new Map(products.map((p) => [p.id, p]));

        // ── 2. Compute line totals using snapshotted prices ───────────────────────
        let subtotal = new Decimal(0);
        const lineItems = data.items.map((item) => {
            const product = productMap.get(item.productId)!;
            const unitPrice = new Decimal(product.sellingPrice);
            const lineDiscount = new Decimal(item.lineDiscount);
            const lineTotal = unitPrice
                .mul(item.quantity)
                .sub(lineDiscount)
                .toDecimalPlaces(2);

            if (lineTotal.lessThan(0)) {
                throw new AppError(
                    `Line discount exceeds line total for product "${product.name}"`,
                    422,
                );
            }

            subtotal = subtotal.add(lineTotal);
            return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice,
                lineDiscount,
                lineTotal,
            };
        });

        // ── 3. Sale-level financials ───────────────────────────────────────────────
        const discountAmount = new Decimal(data.discountAmount);
        const afterDiscount = subtotal.sub(discountAmount);

        if (afterDiscount.lessThan(0)) {
            throw new AppError(
                "Sale-level discount cannot exceed subtotal",
                422,
            );
        }

        const taxAmount = afterDiscount
            .mul(data.taxRate)
            .div(100)
            .toDecimalPlaces(2);

        const totalAmount = afterDiscount.add(taxAmount);

        // ── 4. Persist in a transaction ───────────────────────────────────────────
        const sale = await prisma.$transaction(async (tx) => {
            const created = await tx.sale.create({
                data: {
                    organizationId: orgId,
                    createdById: actorId,
                    status: "PENDING",
                    subtotal,
                    discountAmount,
                    taxAmount,
                    totalAmount,
                    notes: data.notes ?? null,
                    items: {
                        create: lineItems,
                    },
                },
                include: SALE_INCLUDE,
            });
            return created;
        });

        logger.info(
            {
                saleId: sale.id,
                orgId,
                actorId,
                total: totalAmount,
                event: "SALE_CREATED",
            },
            "Sale created",
        );

        const result = sanitizeSale(sale as Parameters<typeof sanitizeSale>[0]);

        SSEManager.broadcast(orgId, "sale.created", {
            saleId: result.id,
            createdByName: result.createdByName,
            totalAmount: result.totalAmount,
            itemCount: result.items.length,
        });

        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LIST & GET
    // ═══════════════════════════════════════════════════════════════════════════

    static async listSales(
        orgId: string,
        callerId: string,
        callerRole: string,
        query: ListSalesQueryDTO,
        req: Request,
    ) {
        const { page, limit, skip, take } = parsePagination(req);
        const { status, createdById, dateFrom, dateTo } = query;

        const where: Record<string, unknown> = {
            organizationId: orgId,
            // ORG_USER can only see their own sales
            ...(callerRole === "ORG_USER" ? { createdById: callerId } : {}),
            ...(status && { status }),
            // Admin filtering by specific user
            ...(createdById && callerRole !== "ORG_USER" && { createdById }),
            ...(dateFrom || dateTo
                ? {
                      createdAt: {
                          ...(dateFrom && { gte: dateFrom }),
                          ...(dateTo && { lte: dateTo }),
                      },
                  }
                : {}),
        };

        const [sales, total] = await Promise.all([
            prisma.sale.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: "desc" },
                include: {
                    createdBy: { select: { name: true } },
                    _count: { select: { items: true } },
                },
            }),
            prisma.sale.count({ where }),
        ]);

        const data: SaleSummaryDTO[] = sales.map((s) => ({
            id: s.id,
            createdByName: s.createdBy.name,
            status: s.status,
            totalAmount: Number(s.totalAmount),
            itemCount: s._count.items,
            createdAt: s.createdAt,
        }));

        return { data, meta: buildPaginationMeta(page, limit, total) };
    }

    static async getSale(
        orgId: string,
        saleId: string,
        callerId: string,
        callerRole: string,
    ): Promise<SaleResponseDTO> {
        const sale = await prisma.sale.findFirst({
            where: { id: saleId, organizationId: orgId },
            include: SALE_INCLUDE,
        });

        if (!sale) throw new AppError("Sale not found", 404);

        // ORG_USER can only see their own sales
        if (callerRole === "ORG_USER" && sale.createdById !== callerId) {
            throw new AppError(
                "Forbidden: you can only view your own sales",
                403,
            );
        }

        return sanitizeSale(sale as Parameters<typeof sanitizeSale>[0]);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // APPROVE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Approve a PENDING sale — commits stock.
     *
     * Creates an OUT StockMovement for each line item inside a transaction.
     * If any product has insufficient stock, the whole transaction rolls back
     * and the sale stays PENDING.
     */
    static async approveSale(
        orgId: string,
        saleId: string,
        actorId: string,
    ): Promise<SaleResponseDTO> {
        const sale = await prisma.sale.findFirst({
            where: { id: saleId, organizationId: orgId },
            include: {
                items: {
                    include: { product: { select: { name: true, sku: true } } },
                },
            },
        });

        if (!sale) throw new AppError("Sale not found", 404);
        if (sale.status !== "PENDING") {
            throw new AppError(
                `Cannot approve a sale with status "${sale.status}"`,
                409,
            );
        }

        const updated = await prisma.$transaction(async (tx) => {
            // Process each line item — deduct stock atomically
            for (const item of sale.items) {
                const product = await tx.product.findUnique({
                    where: { id: item.productId },
                });

                if (!product || product.isArchived) {
                    throw new AppError(
                        `Product "${item.product.name}" is no longer available`,
                        422,
                    );
                }

                const newStock = product.stockLevel - item.quantity;
                if (newStock < 0) {
                    throw new AppError(
                        `Insufficient stock for "${product.name}" (SKU: ${product.sku}). ` +
                            `Available: ${product.stockLevel}, requested: ${item.quantity}`,
                        422,
                    );
                }

                // Update cached stock level
                await tx.product.update({
                    where: { id: product.id },
                    data: { stockLevel: newStock },
                });

                // Write immutable ledger entry
                await tx.stockMovement.create({
                    data: {
                        productId: product.id,
                        performedById: actorId,
                        type: "OUT",
                        quantity: item.quantity,
                        reason: `Sale approved — Sale #${saleId}`,
                        referenceId: saleId,
                        balanceAfter: newStock,
                    },
                });
            }

            // Mark sale as approved
            return tx.sale.update({
                where: { id: saleId },
                data: {
                    status: "APPROVED",
                    processedById: actorId,
                    approvedAt: new Date(),
                },
                include: SALE_INCLUDE,
            });
        });

        logger.info(
            { saleId, orgId, actorId, event: "SALE_APPROVED" },
            "Sale approved — stock deducted",
        );

        const result = sanitizeSale(
            updated as Parameters<typeof sanitizeSale>[0],
        );

        // SSE — notify all org clients
        SSEManager.broadcast(orgId, "sale.approved", {
            saleId: result.id,
            totalAmount: result.totalAmount,
            approvedByName: result.processedByName,
        });

        // Email — notify the sale creator
        const creator = await prisma.orgUser.findUnique({
            where: { id: result.createdById },
            select: { email: true, name: true },
        });

        if (creator) {
            enqueueEmail("send:sale-approved", {
                to: creator.email,
                recipientName: creator.name,
                saleId: result.id,
                totalAmount: result.totalAmount,
                itemCount: result.items.length,
                approvedByName: result.processedByName ?? "A manager",
                currency: "₦",
                saleUrl: `${env.FRONTEND_URL}/sales/${result.id}`,
            });
        }

        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // COMPLETE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Mark an APPROVED sale as COMPLETED (final state — payment received, fulfilled).
     * No stock changes — stock was already committed on APPROVE.
     */
    static async completeSale(
        orgId: string,
        saleId: string,
        actorId: string,
    ): Promise<SaleResponseDTO> {
        const sale = await prisma.sale.findFirst({
            where: { id: saleId, organizationId: orgId },
        });

        if (!sale) throw new AppError("Sale not found", 404);
        if (sale.status !== "APPROVED") {
            throw new AppError(
                `Only APPROVED sales can be completed. Current status: "${sale.status}"`,
                409,
            );
        }

        const updated = await prisma.sale.update({
            where: { id: saleId },
            data: {
                status: "COMPLETED",
                processedById: actorId,
            },
            include: SALE_INCLUDE,
        });

        logger.info(
            { saleId, orgId, actorId, event: "SALE_COMPLETED" },
            "Sale completed",
        );

        const result = sanitizeSale(
            updated as Parameters<typeof sanitizeSale>[0],
        );

        SSEManager.broadcast(orgId, "sale.completed", {
            saleId: result.id,
            totalAmount: result.totalAmount,
        });

        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CANCEL
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Cancel a sale.
     *
     * If PENDING → simply mark cancelled, no stock impact.
     * If APPROVED → reverse each line item with an IN movement, restoring stock.
     * COMPLETED sales cannot be cancelled (use a return/refund flow instead).
     */
    static async cancelSale(
        orgId: string,
        saleId: string,
        data: CancelSaleDTO,
        actorId: string,
    ): Promise<SaleResponseDTO> {
        const sale = await prisma.sale.findFirst({
            where: { id: saleId, organizationId: orgId },
            include: {
                items: {
                    include: { product: { select: { name: true, sku: true } } },
                },
            },
        });

        if (!sale) throw new AppError("Sale not found", 404);

        if (sale.status === "CANCELLED") {
            throw new AppError("Sale is already cancelled", 409);
        }
        if (sale.status === "COMPLETED") {
            throw new AppError(
                "Completed sales cannot be cancelled. Create a return/refund instead.",
                409,
            );
        }

        const updated = await prisma.$transaction(async (tx) => {
            // If approved, reverse stock movements
            if (sale.status === "APPROVED") {
                for (const item of sale.items) {
                    const product = await tx.product.findUnique({
                        where: { id: item.productId },
                    });

                    if (!product) continue; // product may have been deleted — skip gracefully

                    const newStock = product.stockLevel + item.quantity;

                    await tx.product.update({
                        where: { id: product.id },
                        data: { stockLevel: newStock },
                    });

                    await tx.stockMovement.create({
                        data: {
                            productId: product.id,
                            performedById: actorId,
                            type: "IN",
                            quantity: item.quantity,
                            reason: `Sale cancelled — Stock returned for Sale #${saleId}`,
                            referenceId: saleId,
                            balanceAfter: newStock,
                        },
                    });
                }
            }

            return tx.sale.update({
                where: { id: saleId },
                data: {
                    status: "CANCELLED",
                    processedById: actorId,
                    cancelledAt: new Date(),
                    cancellationNote: data.cancellationNote,
                },
                include: SALE_INCLUDE,
            });
        });

        logger.info(
            {
                saleId,
                orgId,
                actorId,
                wasApproved: sale.status === "APPROVED",
                event: "SALE_CANCELLED",
            },
            "Sale cancelled",
        );

        const result = sanitizeSale(
            updated as Parameters<typeof sanitizeSale>[0],
        );

        SSEManager.broadcast(orgId, "sale.cancelled", {
            saleId: result.id,
            cancellationNote: data.cancellationNote,
            stockReturned: sale.status === "APPROVED",
        });

        return result;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SUMMARY / REPORTING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Aggregate sales summary for reporting dashboards.
     * Only counts APPROVED and COMPLETED sales for revenue figures.
     */
    static async getSalesSummary(
        orgId: string,
        query: SalesSummaryQueryDTO,
    ): Promise<SalesSummaryDTO> {
        const { dateFrom, dateTo, topProductsLimit } = query;

        const dateFilter =
            dateFrom || dateTo
                ? {
                      createdAt: {
                          ...(dateFrom && { gte: dateFrom }),
                          ...(dateTo && { lte: dateTo }),
                      },
                  }
                : {};

        // ── Status counts (all statuses) ──────────────────────────────────────────
        const statusCounts = await prisma.sale.groupBy({
            by: ["status"],
            where: { organizationId: orgId, ...dateFilter },
            _count: { id: true },
        });

        const byStatus = {
            PENDING: 0,
            APPROVED: 0,
            COMPLETED: 0,
            CANCELLED: 0,
        } as Record<SaleStatus, number>;

        for (const row of statusCounts) {
            byStatus[row.status] = row._count.id;
        }

        // ── Revenue aggregation (APPROVED + COMPLETED only) ───────────────────────
        const revenueAgg = await prisma.sale.aggregate({
            where: {
                organizationId: orgId,
                status: { in: ["APPROVED", "COMPLETED"] },
                ...dateFilter,
            },
            _sum: { totalAmount: true },
            _count: { id: true },
        });

        const totalRevenue = Number(revenueAgg._sum.totalAmount ?? 0);
        const totalSales = revenueAgg._count.id;
        const averageOrderValue =
            totalSales > 0
                ? parseFloat((totalRevenue / totalSales).toFixed(2))
                : 0;

        // ── Top products by quantity sold ─────────────────────────────────────────
        const topProductRows = await prisma.saleItem.groupBy({
            by: ["productId"],
            where: {
                sale: {
                    organizationId: orgId,
                    status: { in: ["APPROVED", "COMPLETED"] },
                    ...dateFilter,
                },
            },
            _sum: { quantity: true, lineTotal: true },
            orderBy: { _sum: { quantity: "desc" } },
            take: topProductsLimit,
        });

        const productIds = topProductRows.map((r) => r.productId);
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
        });
        const productNameMap = new Map(products.map((p) => [p.id, p.name]));

        const topProducts = topProductRows.map((row) => ({
            productId: row.productId,
            productName: productNameMap.get(row.productId) ?? "Unknown",
            totalQuantitySold: row._sum.quantity ?? 0,
            totalRevenue: Number(row._sum.lineTotal ?? 0),
        }));

        return {
            totalSales,
            totalRevenue,
            averageOrderValue,
            byStatus,
            topProducts,
        };
    }
}
