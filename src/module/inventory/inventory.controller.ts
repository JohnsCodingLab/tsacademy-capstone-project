import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { sendSuccess } from "@/utils/response.js";
import { InventoryService } from "./inventory.service.js";
import { ActivityService, ActivityAction } from "@/libs/activity.service.js";
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
import type { InventoryParams } from "@/types/types.js";

// ─── Categories ───────────────────────────────────────────────────────────────

export const listCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const categories = await InventoryService.listCategories(req.org!.id);
    sendSuccess(res, categories, 200, "Categories fetched");
  },
);

export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const category = await InventoryService.createCategory(
      req.org!.id,
      req.body as CreateCategoryDTO,
      req.user!.id,
    );
    sendSuccess(res, { category }, 201, "Category created");
  },
);

export const updateCategory = asyncHandler(
  async (req: Request<InventoryParams>, res: Response) => {
    const category = await InventoryService.updateCategory(
      req.org!.id,
      req.params.categoryId,
      req.body as UpdateCategoryDTO,
    );
    sendSuccess(res, { category }, 200, "Category updated");
  },
);

export const deleteCategory = asyncHandler(
  async (req: Request<InventoryParams>, res: Response) => {
    await InventoryService.deleteCategory(req.org!.id, req.params.categoryId);
    sendSuccess(res, null, 200, "Category deleted");
  },
);

// ─── Products ─────────────────────────────────────────────────────────────────

export const listProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await InventoryService.listProducts(
      req.org!.id,
      req.query as unknown as ListProductsQueryDTO,
      req,
    );
    sendSuccess(res, result.data, 200, "Products fetched", result.meta);
  },
);

export const getProduct = asyncHandler(
  async (req: Request<InventoryParams>, res: Response) => {
    const product = await InventoryService.getProduct(
      req.org!.id,
      req.params.productId,
    );
    sendSuccess(res, { product }, 200);
  },
);

export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const product = await InventoryService.createProduct(
      req.org!.id,
      req.body as CreateProductDTO,
      req.user!.id,
    );

    ActivityService.log({
      userId: req.user!.id,
      action: ActivityAction.PRODUCT_CREATED,
      metadata: { productId: product.id, sku: product.sku },
      req,
    });

    sendSuccess(res, { product }, 201, "Product created");
  },
);

export const updateProduct = asyncHandler(
  async (req: Request<InventoryParams>, res: Response) => {
    const product = await InventoryService.updateProduct(
      req.org!.id,
      req.params.productId,
      req.body as UpdateProductDTO,
      req.user!.id,
    );

    ActivityService.log({
      userId: req.user!.id,
      action: ActivityAction.PRODUCT_UPDATED,
      metadata: { productId: req.params.productId, changes: req.body },
      req,
    });

    sendSuccess(res, { product }, 200, "Product updated");
  },
);

export const archiveProduct = asyncHandler(
  async (req: Request<InventoryParams>, res: Response) => {
    await InventoryService.archiveProduct(
      req.org!.id,
      req.params.productId,
      req.user!.id,
    );

    ActivityService.log({
      userId: req.user!.id,
      action: ActivityAction.PRODUCT_DELETED, // logical archive = "deleted" for audit trail
      metadata: { productId: req.params.productId, action: "ARCHIVE" },
      req,
    });

    sendSuccess(res, null, 200, "Product archived");
  },
);

export const restoreProduct = asyncHandler(
  async (req: Request<InventoryParams>, res: Response) => {
    await InventoryService.restoreProduct(
      req.org!.id,
      req.params.productId,
      req.user!.id,
    );

    ActivityService.log({
      userId: req.user!.id,
      action: ActivityAction.PRODUCT_UPDATED,
      metadata: { productId: req.params.productId, action: "RESTORE" },
      req,
    });

    sendSuccess(res, null, 200, "Product restored");
  },
);

// ─── Stock ────────────────────────────────────────────────────────────────────

export const adjustStock = asyncHandler(
  async (req: Request<InventoryParams>, res: Response) => {
    const movement = await InventoryService.adjustStock(
      req.org!.id,
      req.params.productId,
      req.body as StockAdjustmentDTO,
      req.user!.id,
    );

    ActivityService.log({
      userId: req.user!.id,
      action: ActivityAction.STOCK_ADJUSTED,
      metadata: {
        productId: req.params.productId,
        type: movement.type,
        quantity: movement.quantity,
        balanceAfter: movement.balanceAfter,
      },
      req,
    });

    sendSuccess(res, { movement }, 201, "Stock adjusted successfully");
  },
);

export const getMovementHistory = asyncHandler(
  async (req: Request<InventoryParams>, res: Response) => {
    const result = await InventoryService.getMovementHistory(
      req.org!.id,
      req.params.productId,
      req.query as unknown as MovementHistoryQueryDTO,
      req,
    );
    sendSuccess(res, result.data, 200, "Movement history fetched", result.meta);
  },
);

// ─── Insights ─────────────────────────────────────────────────────────────────

export const getLowStockAlerts = asyncHandler(
  async (req: Request, res: Response) => {
    const products = await InventoryService.getLowStockAlerts(req.org!.id);
    sendSuccess(
      res,
      products,
      200,
      `${products.length} low-stock product(s) found`,
    );
  },
);

export const getForecast = asyncHandler(async (req: Request, res: Response) => {
  const result = await InventoryService.getForecast(
    req.org!.id,
    req.query as unknown as ForecastQueryDTO,
  );
  sendSuccess(res, result, 200, "Forecast computed");
});
