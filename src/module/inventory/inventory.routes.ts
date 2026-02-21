import { Router } from "express";
import { authenticate } from "@/middlewares/auth.middleware.js";
import { authorize } from "@/middlewares/rbac.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import type { OrgRole } from "@/generated/prisma/index.js";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryParamSchema,
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  productParamSchema,
  stockAdjustmentSchema,
  movementHistorySchema,
  forecastQuerySchema,
  orgSlugParam,
} from "./inventory.schema.js";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  archiveProduct,
  restoreProduct,
  adjustStock,
  getMovementHistory,
  getLowStockAlerts,
  getForecast,
} from "./inventory.controller.js";
import { requireOrgAccess } from "@/middlewares/orgAccess..middleware.js";

const router = Router({ mergeParams: true });

// All routes require a valid org-scoped session
router.use(authenticate, requireOrgAccess);

const MANAGERS: OrgRole[] = ["ORG_SUPER_ADMIN", "ORG_ADMIN"];
const ALL_ROLES: OrgRole[] = ["ORG_SUPER_ADMIN", "ORG_ADMIN", "ORG_USER"];

// ─── Categories ───────────────────────────────────────────────────────────────
// GET    /inventory/categories              → all roles (read-only)
// POST   /inventory/categories              → managers only
// PATCH  /inventory/categories/:categoryId → managers only
// DELETE /inventory/categories/:categoryId → managers only

router.get(
  "/categories",
  authorize<OrgRole>(...ALL_ROLES),
  validate(orgSlugParam),
  listCategories,
);
router.post(
  "/categories",
  authorize<OrgRole>(...MANAGERS),
  validate(createCategorySchema),
  createCategory,
);
router.patch(
  "/categories/:categoryId",
  authorize<OrgRole>(...MANAGERS),
  validate(updateCategorySchema),
  updateCategory,
);
router.delete(
  "/categories/:categoryId",
  authorize<OrgRole>(...MANAGERS),
  validate(categoryParamSchema),
  deleteCategory,
);

// ─── Products ─────────────────────────────────────────────────────────────────
// GET    /inventory/products                         → all roles
// GET    /inventory/products/:productId              → all roles
// POST   /inventory/products                         → managers only
// PATCH  /inventory/products/:productId              → managers only
// PATCH  /inventory/products/:productId/archive      → managers only
// PATCH  /inventory/products/:productId/restore      → super admin only

router.get(
  "/products",
  authorize<OrgRole>(...ALL_ROLES),
  validate(listProductsSchema),
  listProducts,
);
router.get(
  "/products/:productId",
  authorize<OrgRole>(...ALL_ROLES),
  validate(productParamSchema),
  getProduct,
);
router.post(
  "/products",
  authorize<OrgRole>(...MANAGERS),
  validate(createProductSchema),
  createProduct,
);
router.patch(
  "/products/:productId",
  authorize<OrgRole>(...MANAGERS),
  validate(updateProductSchema),
  updateProduct,
);
router.patch(
  "/products/:productId/archive",
  authorize<OrgRole>(...MANAGERS),
  validate(productParamSchema),
  archiveProduct,
);
router.patch(
  "/products/:productId/restore",
  authorize<OrgRole>("ORG_SUPER_ADMIN"),
  validate(productParamSchema),
  restoreProduct,
);

// ─── Stock ────────────────────────────────────────────────────────────────────
// POST /inventory/products/:productId/adjust          → managers only
// GET  /inventory/products/:productId/movements       → all roles

router.post(
  "/products/:productId/adjust",
  authorize<OrgRole>(...MANAGERS),
  validate(stockAdjustmentSchema),
  adjustStock,
);
router.get(
  "/products/:productId/movements",
  authorize<OrgRole>(...ALL_ROLES),
  validate(movementHistorySchema),
  getMovementHistory,
);

// ─── Insights ─────────────────────────────────────────────────────────────────
// GET /inventory/alerts    → all roles (staff needs to see this on the floor)
// GET /inventory/forecast  → managers only (business-sensitive data)

router.get(
  "/alerts",
  authorize<OrgRole>(...ALL_ROLES),
  validate(orgSlugParam),
  getLowStockAlerts,
);
router.get(
  "/forecast",
  authorize<OrgRole>(...MANAGERS),
  validate(forecastQuerySchema),
  getForecast,
);

export default router;
