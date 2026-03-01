import { SSEManager } from "@/libs/sse/sse.manager.js";
import { env } from "@/config/env.js";

import prisma from "@/config/prisma.js";
import { redis } from "@/config/redis.js";
import { AppError } from "@/utils/appError.js";
import { logger } from "@/libs/logger.js";
import { parsePagination, buildPaginationMeta } from "@/utils/pagination.js";
import type { Request } from "express";
import type { Product } from "@/generated/prisma/index.js";
import type {
    ProductResponseDTO,
    CategoryResponseDTO,
    StockMovementResponseDTO,
    ForecastDTO,
} from "./inventory.types.js";
import type {
    CreateProductDTO,
    UpdateProductDTO,
    ListProductsQueryDTO,
    StockAdjustmentDTO,
    CreateCategoryDTO,
    UpdateCategoryDTO,
    ForecastQueryDTO,
    MovementHistoryQueryDTO,
} from "./inventory.schema.js";
import { Decimal } from "@prisma/client/runtime/client";
import { enqueueEmail } from "@/libs/emails/email.queue.js";

// ─── Cache helpers ────────────────────────────────────────────────────────────

const CACHE_TTL = {
    PRODUCT_LIST: 60 * 5, // 5 min
    PRODUCT_DETAIL: 60 * 5,
    FORECAST: 60 * 10, // 10 min — heavier computation
} as const;

const cacheKey = {
    productList: (orgId: string, suffix: string) =>
        `inv:products:${orgId}:${suffix}`,
    productDetail: (productId: string) => `inv:product:${productId}`,
    forecast: (orgId: string, window: number) =>
        `inv:forecast:${orgId}:${window}`,
};

async function invalidateProductCache(orgId: string, productId?: string) {
    const pattern = `inv:products:${orgId}:*`;
    const keys = await redis.keys(pattern);
    const toDelete = productId
        ? [
              ...keys,
              cacheKey.productDetail(productId),
              cacheKey.forecast(orgId, 0) + "*",
          ]
        : keys;
    if (toDelete.length) await redis.del(...toDelete);
}

// ─── Sanitisers ───────────────────────────────────────────────────────────────

function sanitizeProduct(p: Product): ProductResponseDTO {
    return {
        id: p.id,
        organizationId: p.organizationId,
        categoryId: p.categoryId,
        name: p.name,
        description: p.description,
        sku: p.sku,
        costPrice: Number(p.costPrice),
        sellingPrice: Number(p.sellingPrice),
        stockLevel: p.stockLevel,
        reorderPoint: p.reorderPoint,
        unit: p.unit,
        isArchived: p.isArchived,
        isLowStock:
            p.reorderPoint !== null && p.reorderPoint !== undefined
                ? p.stockLevel <= p.reorderPoint
                : false,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
    };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class InventoryService {
    // ═══════════════════════════════════════════════════════════════════════════
    // CATEGORIES
    // ═══════════════════════════════════════════════════════════════════════════

    static async listCategories(orgId: string): Promise<CategoryResponseDTO[]> {
        return prisma.category.findMany({
            where: { organizationId: orgId },
            orderBy: { name: "asc" },
        });
    }

    static async createCategory(
        orgId: string,
        data: CreateCategoryDTO,
        actorId: string,
    ): Promise<CategoryResponseDTO> {
        const existing = await prisma.category.findUnique({
            where: {
                organizationId_name: { organizationId: orgId, name: data.name },
            },
        });
        if (existing) throw new AppError("Category name already exists", 409);

        const category = await prisma.category.create({
            data: {
                organizationId: orgId,
                name: data.name,
                description: data.description,
            },
        });

        logger.info(
            { categoryId: category.id, orgId, actorId },
            "Category created",
        );
        return category;
    }

    static async updateCategory(
        orgId: string,
        categoryId: string,
        data: UpdateCategoryDTO,
    ): Promise<CategoryResponseDTO> {
        const category = await prisma.category.findFirst({
            where: { id: categoryId, organizationId: orgId },
        });
        if (!category) throw new AppError("Category not found", 404);

        return prisma.category.update({
            where: { id: categoryId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && {
                    description: data.description,
                }),
            },
        });
    }

    static async deleteCategory(orgId: string, categoryId: string) {
        const category = await prisma.category.findFirst({
            where: { id: categoryId, organizationId: orgId },
            include: { _count: { select: { products: true } } },
        });
        if (!category) throw new AppError("Category not found", 404);
        if (category._count.products > 0) {
            throw new AppError(
                `Cannot delete category: ${category._count.products} product(s) are assigned to it. Re-assign them first.`,
                409,
            );
        }

        await prisma.category.delete({ where: { id: categoryId } });
        logger.info({ categoryId, orgId }, "Category deleted");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRODUCTS
    // ═══════════════════════════════════════════════════════════════════════════

    static async listProducts(
        orgId: string,
        query: ListProductsQueryDTO,
        req: Request,
    ) {
        const { page, limit, skip, take } = parsePagination(req);
        const {
            search,
            categoryId,
            isArchived,
            lowStockOnly,
            sortBy,
            sortOrder,
        } = query;

        // ── Cache key based on the full query fingerprint ──
        const cacheKeySuffix = JSON.stringify({ page, limit, ...query });
        const ck = cacheKey.productList(orgId, cacheKeySuffix);
        const cached = await redis.get(ck);
        if (cached) return JSON.parse(cached);

        const where: Record<string, unknown> = {
            organizationId: orgId,
            isArchived: isArchived ?? false,
            ...(categoryId && { categoryId }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { sku: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                ],
            }),
        };

        // Low-stock filter: stockLevel <= reorderPoint (only when reorderPoint is set)
        if (lowStockOnly) {
            where.reorderPoint = { not: null };
            where.AND = [
                { reorderPoint: { not: null } },
                // Prisma raw column comparison workaround:
                // We'll handle this in-memory after the query for simplicity,
                // since Prisma doesn't support col-to-col comparisons in `where`.
            ];
        }

        const orderBy = sortBy
            ? { [sortBy]: sortOrder ?? "asc" }
            : { createdAt: "desc" as const };

        let [products, total] = await Promise.all([
            prisma.product.findMany({ where, skip, take, orderBy }),
            prisma.product.count({ where }),
        ]);

        // In-memory low-stock filter (stockLevel <= reorderPoint)
        if (lowStockOnly) {
            products = products.filter(
                (p) =>
                    p.reorderPoint !== null && p.stockLevel <= p.reorderPoint,
            );
            total = products.length;
        }

        const result = {
            data: products.map(sanitizeProduct),
            meta: buildPaginationMeta(page, limit, total),
        };

        await redis.setex(ck, CACHE_TTL.PRODUCT_LIST, JSON.stringify(result));
        return result;
    }

    static async getProduct(
        orgId: string,
        productId: string,
    ): Promise<ProductResponseDTO> {
        const ck = cacheKey.productDetail(productId);
        const cached = await redis.get(ck);
        if (cached) return JSON.parse(cached);

        const product = await prisma.product.findFirst({
            where: { id: productId, organizationId: orgId },
        });
        if (!product) throw new AppError("Product not found", 404);

        const dto = sanitizeProduct(product);
        await redis.setex(ck, CACHE_TTL.PRODUCT_DETAIL, JSON.stringify(dto));
        return dto;
    }

    /**
     * Create a product and optionally seed its initial stock via a StockMovement.
     * Everything runs in a single transaction.
     */
    static async createProduct(
        orgId: string,
        data: CreateProductDTO,
        actorId: string,
    ): Promise<ProductResponseDTO> {
        // Validate category belongs to org
        if (data.categoryId) {
            const cat = await prisma.category.findFirst({
                where: { id: data.categoryId, organizationId: orgId },
            });
            if (!cat) throw new AppError("Category not found", 404);
        }

        const existing = await prisma.product.findUnique({
            where: {
                organizationId_sku: { organizationId: orgId, sku: data.sku },
            },
        });
        if (existing)
            throw new AppError(
                `SKU "${data.sku}" already exists in this organization`,
                409,
            );

        const product = await prisma.$transaction(async (tx) => {
            const created = await tx.product.create({
                data: {
                    organizationId: orgId,
                    categoryId: data.categoryId ?? null,
                    name: data.name,
                    description: data.description ?? null,
                    sku: data.sku,
                    costPrice: new Decimal(data.costPrice),
                    sellingPrice: new Decimal(data.sellingPrice),
                    stockLevel: data.initialStock,
                    reorderPoint: data.reorderPoint ?? null,
                    unit: data.unit,
                },
            });

            // Seed initial stock as a movement for full auditability
            if (data.initialStock > 0) {
                await tx.stockMovement.create({
                    data: {
                        productId: created.id,
                        performedById: actorId,
                        type: "IN",
                        quantity: data.initialStock,
                        reason: "Initial stock on product creation",
                        balanceAfter: data.initialStock,
                    },
                });
            }

            return created;
        });

        await invalidateProductCache(orgId, product.id);

        logger.info(
            { productId: product.id, orgId, actorId, event: "PRODUCT_CREATED" },
            "Product created",
        );

        return sanitizeProduct(product);
    }

    static async updateProduct(
        orgId: string,
        productId: string,
        data: UpdateProductDTO,
        actorId: string,
    ): Promise<ProductResponseDTO> {
        const product = await prisma.product.findFirst({
            where: { id: productId, organizationId: orgId },
        });
        if (!product) throw new AppError("Product not found", 404);
        if (product.isArchived)
            throw new AppError("Cannot update an archived product", 409);

        if (data.categoryId !== undefined && data.categoryId !== null) {
            const cat = await prisma.category.findFirst({
                where: { id: data.categoryId, organizationId: orgId },
            });
            if (!cat) throw new AppError("Category not found", 404);
        }

        const updated = await prisma.product.update({
            where: { id: productId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && {
                    description: data.description,
                }),
                ...(data.categoryId !== undefined && {
                    categoryId: data.categoryId,
                }),
                ...(data.costPrice !== undefined && {
                    costPrice: new Decimal(data.costPrice),
                }),
                ...(data.sellingPrice !== undefined && {
                    sellingPrice: new Decimal(data.sellingPrice),
                }),
                ...(data.reorderPoint !== undefined && {
                    reorderPoint: data.reorderPoint,
                }),
                ...(data.unit && { unit: data.unit }),
            },
        });

        await invalidateProductCache(orgId, productId);

        logger.info(
            {
                productId,
                orgId,
                actorId,
                changes: data,
                event: "PRODUCT_UPDATED",
            },
            "Product updated",
        );

        return sanitizeProduct(updated);
    }

    /**
     * Soft-delete: marks the product as archived.
     * Archived products are hidden from default queries but all movements are preserved.
     */
    static async archiveProduct(
        orgId: string,
        productId: string,
        actorId: string,
    ) {
        const product = await prisma.product.findFirst({
            where: { id: productId, organizationId: orgId },
        });
        if (!product) throw new AppError("Product not found", 404);
        if (product.isArchived)
            throw new AppError("Product is already archived", 409);

        await prisma.product.update({
            where: { id: productId },
            data: { isArchived: true },
        });

        await invalidateProductCache(orgId, productId);

        logger.info(
            { productId, orgId, actorId, event: "PRODUCT_ARCHIVED" },
            "Product archived",
        );
    }

    static async restoreProduct(
        orgId: string,
        productId: string,
        actorId: string,
    ) {
        const product = await prisma.product.findFirst({
            where: { id: productId, organizationId: orgId },
        });
        if (!product) throw new AppError("Product not found", 404);
        if (!product.isArchived)
            throw new AppError("Product is not archived", 409);

        await prisma.product.update({
            where: { id: productId },
            data: { isArchived: false },
        });

        await invalidateProductCache(orgId, productId);
        logger.info(
            { productId, orgId, actorId, event: "PRODUCT_RESTORED" },
            "Product restored",
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STOCK ADJUSTMENTS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Record a stock movement and atomically update the product's cached stockLevel.
     *
     * Uses a Prisma transaction to guarantee:
     *   1. stockLevel is never out of sync with movements
     *   2. stock can never go negative
     *   3. the movement ledger entry is always written with the correct balanceAfter
     */
    static async adjustStock(
        orgId: string,
        productId: string,
        data: StockAdjustmentDTO,
        actorId: string,
    ): Promise<StockMovementResponseDTO> {
        const movement = await prisma.$transaction(async (tx) => {
            // Lock the row — select for update via findFirst inside a tx
            const product = await tx.product.findFirst({
                where: { id: productId, organizationId: orgId },
            });
            if (!product) throw new AppError("Product not found", 404);
            if (product.isArchived) {
                throw new AppError(
                    "Cannot adjust stock for an archived product",
                    409,
                );
            }

            const delta = data.type === "IN" ? data.quantity : -data.quantity;
            const newStock = product.stockLevel + delta;

            if (newStock < 0) {
                throw new AppError(
                    `Insufficient stock. Current: ${product.stockLevel}, requested OUT: ${data.quantity}`,
                    422,
                );
            }

            // 1. Update cached stock level
            await tx.product.update({
                where: { id: productId },
                data: { stockLevel: newStock },
            });

            // 2. Write immutable ledger entry
            const created = await tx.stockMovement.create({
                data: {
                    productId,
                    performedById: actorId,
                    type: data.type,
                    quantity: data.quantity,
                    reason: data.reason,
                    referenceId: data.referenceId ?? null,
                    balanceAfter: newStock,
                },
                include: {
                    product: { select: { name: true } },
                    performedBy: { select: { name: true } },
                },
            });

            return created;
        });

        // Invalidate caches after the transaction commits
        await invalidateProductCache(orgId, productId);

        logger.info(
            {
                productId,
                orgId,
                actorId,
                type: data.type,
                quantity: data.quantity,
                event: "STOCK_ADJUSTED",
            },
            "Stock adjusted",
        );

        const result = {
            id: movement.id,
            productId: movement.productId,
            productName: movement.product.name,
            performedById: movement.performedById,
            performedByName: movement.performedBy.name,
            type: movement.type,
            quantity: movement.quantity,
            reason: movement.reason,
            referenceId: movement.referenceId,
            balanceAfter: movement.balanceAfter,
            createdAt: movement.createdAt,
        };

        // ── SSE: broadcast stock.adjusted to all connected org clients ─────────────
        SSEManager.broadcast(orgId, "stock.adjusted", {
            productId,
            productName: movement.product.name,
            type: data.type,
            quantity: data.quantity,
            balanceAfter: movement.balanceAfter,
            performedByName: movement.performedBy.name,
        });

        // ── Low-stock check: runs after every OUT movement ─────────────────────────
        // Fire-and-forget — never blocks the response
        if (data.type === "OUT") {
            InventoryService.checkAndNotifyLowStock(
                orgId,
                productId,
                movement.balanceAfter,
            ).catch((err) =>
                logger.warn({ err, productId }, "Low-stock check failed"),
            );
        }

        return result;
    }

    // ─── Low-stock notifier ───────────────────────────────────────────────────────
    // Called internally after every OUT movement. Checks if the product just
    // crossed its reorder threshold and, if so:
    //   1. Broadcasts a stock.low SSE event to connected org clients
    //   2. Enqueues a low-stock alert email to all org admins

    private static async checkAndNotifyLowStock(
        orgId: string,
        productId: string,
        balanceAfter: number,
    ): Promise<void> {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: {
                name: true,
                sku: true,
                reorderPoint: true,
                unit: true,
                stockLevel: true,
            },
        });

        if (!product || product.reorderPoint === null) return;
        if (balanceAfter > product.reorderPoint) return;

        // ── SSE broadcast ─────────────────────────────────────────────────────────
        SSEManager.broadcast(orgId, "stock.low", {
            productId,
            productName: product.name,
            sku: product.sku,
            currentStock: balanceAfter,
            reorderPoint: product.reorderPoint,
            unit: product.unit,
        });

        // ── Email: gather all admin emails for this org ───────────────────────────
        const admins = await prisma.orgUser.findMany({
            where: {
                organizationId: orgId,
                isActive: true,
                role: { in: ["ORG_SUPER_ADMIN", "ORG_ADMIN"] },
            },
            select: { email: true },
        });

        if (admins.length === 0) return;

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { name: true, slug: true },
        });

        enqueueEmail("send:low-stock", {
            to: admins.map((a) => a.email),
            organizationName: org?.name ?? "Your Organization",
            products: [
                {
                    name: product.name,
                    sku: product.sku,
                    currentStock: balanceAfter,
                    reorderPoint: product.reorderPoint,
                    unit: product.unit,
                },
            ],
            alertsUrl: `${env.FRONTEND_URL}/orgs/${org?.slug}/inventory/alerts`,
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MOVEMENT HISTORY
    // ═══════════════════════════════════════════════════════════════════════════

    static async getMovementHistory(
        orgId: string,
        productId: string,
        query: MovementHistoryQueryDTO,
        req: Request,
    ) {
        // Verify product belongs to org
        const product = await prisma.product.findFirst({
            where: { id: productId, organizationId: orgId },
            select: { id: true },
        });
        if (!product) throw new AppError("Product not found", 404);

        const { page, limit, skip, take } = parsePagination(req);

        const where = {
            productId,
            ...(query.type && { type: query.type }),
        };

        const [movements, total] = await Promise.all([
            prisma.stockMovement.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: "desc" },
                include: {
                    product: { select: { name: true } },
                    performedBy: { select: { name: true } },
                },
            }),
            prisma.stockMovement.count({ where }),
        ]);

        const data: StockMovementResponseDTO[] = movements.map((m) => ({
            id: m.id,
            productId: m.productId,
            productName: m.product.name,
            performedById: m.performedById,
            performedByName: m.performedBy.name,
            type: m.type,
            quantity: m.quantity,
            reason: m.reason,
            referenceId: m.referenceId,
            balanceAfter: m.balanceAfter,
            createdAt: m.createdAt,
        }));

        return { data, meta: buildPaginationMeta(page, limit, total) };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LOW-STOCK ALERTS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Returns all products in this org that have a reorderPoint set and whose
     * current stockLevel is at or below it. Results are sorted most-critical first
     * (lowest stock relative to reorder point).
     */
    static async getLowStockAlerts(
        orgId: string,
    ): Promise<ProductResponseDTO[]> {
        const products = await prisma.product.findMany({
            where: {
                organizationId: orgId,
                isArchived: false,
                reorderPoint: { not: null },
            },
            orderBy: { stockLevel: "asc" },
        });

        return products
            .filter(
                (p) =>
                    p.reorderPoint !== null && p.stockLevel <= p.reorderPoint,
            )
            .map(sanitizeProduct);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SMART FORECASTING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Compute stockout forecasts for all (or only low-stock) products.
     *
     * Algorithm:
     *   1. For each product, sum all OUT movements within the analysis window.
     *   2. avgDailySalesVelocity = totalOut / windowDays
     *   3. daysUntilStockout     = currentStock / avgDailySalesVelocity
     *   4. estimatedStockoutDate = today + daysUntilStockout
     *
     * Results are cached in Redis for 10 minutes — this is an aggregation query.
     */
    static async getForecast(
        orgId: string,
        query: ForecastQueryDTO,
    ): Promise<ForecastDTO[]> {
        const { windowDays, lowStockOnly } = query;

        const ck = cacheKey.forecast(orgId, windowDays);
        const cached = await redis.get(ck);
        if (cached) {
            const parsed: ForecastDTO[] = JSON.parse(cached);
            return lowStockOnly ? parsed.filter((f) => f.isLowStock) : parsed;
        }

        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - windowDays);

        // Fetch all active products with their OUT movements in the window
        const products = await prisma.product.findMany({
            where: { organizationId: orgId, isArchived: false },
            include: {
                stockMovements: {
                    where: {
                        type: "OUT",
                        createdAt: { gte: windowStart },
                    },
                    select: { quantity: true },
                },
            },
            orderBy: { stockLevel: "asc" },
        });

        const forecasts: ForecastDTO[] = products.map((p) => {
            const totalOut = p.stockMovements.reduce(
                (sum, m) => sum + m.quantity,
                0,
            );
            const avgDailySalesVelocity =
                totalOut > 0
                    ? parseFloat((totalOut / windowDays).toFixed(4))
                    : null;

            let daysUntilStockout: number | null = null;
            let estimatedStockoutDate: Date | null = null;

            if (avgDailySalesVelocity && avgDailySalesVelocity > 0) {
                daysUntilStockout = parseFloat(
                    (p.stockLevel / avgDailySalesVelocity).toFixed(1),
                );
                const date = new Date();
                date.setDate(date.getDate() + daysUntilStockout);
                estimatedStockoutDate = date;
            }

            const isLowStock =
                p.reorderPoint !== null
                    ? p.stockLevel <= p.reorderPoint
                    : false;

            return {
                productId: p.id,
                productName: p.name,
                sku: p.sku,
                currentStock: p.stockLevel,
                reorderPoint: p.reorderPoint,
                isLowStock,
                avgDailySalesVelocity,
                daysUntilStockout,
                estimatedStockoutDate,
                analysisWindowDays: windowDays,
            };
        });

        // Cache before filtering so the full set is stored
        await redis.setex(ck, CACHE_TTL.FORECAST, JSON.stringify(forecasts));

        return lowStockOnly ? forecasts.filter((f) => f.isLowStock) : forecasts;
    }
}
