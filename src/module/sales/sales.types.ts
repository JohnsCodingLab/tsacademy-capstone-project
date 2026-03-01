import type { SaleStatus } from "@/generated/prisma/index.js";

// ─── Line Item ────────────────────────────────────────────────────────────────

export interface SaleItemResponseDTO {
    id: string;
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    unitPrice: number;
    lineDiscount: number;
    lineTotal: number;
}

// ─── Sale ─────────────────────────────────────────────────────────────────────

export interface SaleResponseDTO {
    id: string;
    organizationId: string;
    createdById: string;
    createdByName: string;
    processedById: string | null;
    processedByName: string | null;
    status: SaleStatus;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    notes: string | null;
    approvedAt: Date | null;
    cancelledAt: Date | null;
    cancellationNote: string | null;
    items: SaleItemResponseDTO[];
    createdAt: Date;
    updatedAt: Date;
}

export interface SaleSummaryDTO {
    id: string;
    createdByName: string;
    status: SaleStatus;
    totalAmount: number;
    itemCount: number;
    createdAt: Date;
}

// ─── Dashboard / Reporting ────────────────────────────────────────────────────

export interface SalesSummaryDTO {
    totalSales: number;
    totalRevenue: number;
    averageOrderValue: number;
    byStatus: Record<SaleStatus, number>;
    topProducts: Array<{
        productId: string;
        productName: string;
        totalQuantitySold: number;
        totalRevenue: number;
    }>;
}
