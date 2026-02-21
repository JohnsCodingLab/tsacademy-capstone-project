import type { MovementType } from "@/generated/prisma/index.js";

// ─── Product ──────────────────────────────────────────────────────────────────

export interface ProductResponseDTO {
  id: string;
  organizationId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  stockLevel: number;
  reorderPoint: number | null;
  unit: string;
  isArchived: boolean;
  isLowStock: boolean; // computed: stockLevel <= reorderPoint
  createdAt: Date;
  updatedAt: Date;
}

// ─── Category ─────────────────────────────────────────────────────────────────

export interface CategoryResponseDTO {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Stock Movement ───────────────────────────────────────────────────────────

export interface StockMovementResponseDTO {
  id: string;
  productId: string;
  productName: string;
  performedById: string;
  performedByName: string;
  type: MovementType;
  quantity: number;
  reason: string;
  referenceId: string | null;
  balanceAfter: number;
  createdAt: Date;
}

// ─── Forecasting ──────────────────────────────────────────────────────────────

export interface ForecastDTO {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  reorderPoint: number | null;
  isLowStock: boolean;
  avgDailySalesVelocity: number | null;
  daysUntilStockout: number | null;
  estimatedStockoutDate: Date | null;
  analysisWindowDays: number;
}
