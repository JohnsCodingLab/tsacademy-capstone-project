import { Router } from "express";
import { authenticate } from "@/middlewares/auth.middleware.js";
import { authorize } from "@/middlewares/rbac.middleware.js";
import { requireOrgAccess } from "@/middlewares/orgAccess.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import type { OrgRole } from "@/generated/prisma/index.js";
import {
    createSaleSchema,
    listSalesSchema,
    saleParamSchema,
    cancelSaleSchema,
    salesSummarySchema,
    orgSlugOnlyParam,
} from "./sales.schema.js";
import {
    createSale,
    listSales,
    getSale,
    approveSale,
    completeSale,
    cancelSale,
    getSalesSummary,
} from "./sales.controller.js";

const router = Router({ mergeParams: true });

router.use(authenticate, requireOrgAccess);

const MANAGERS: OrgRole[] = ["ORG_SUPER_ADMIN", "ORG_ADMIN"];
const ALL_ROLES: OrgRole[] = ["ORG_SUPER_ADMIN", "ORG_ADMIN", "ORG_USER"];

// ─── Sales CRUD ───────────────────────────────────────────────────────────────
// POST   /sales              → all roles (any user can raise a sale)
// GET    /sales              → all roles (ORG_USER sees own only — enforced in service)
// GET    /sales/summary      → managers only (revenue data)
// GET    /sales/:saleId      → all roles (ORG_USER gated in service)
// PATCH  /sales/:saleId/approve  → managers only
// PATCH  /sales/:saleId/complete → managers only
// PATCH  /sales/:saleId/cancel   → managers only

router.post(
    "/",
    authorize<OrgRole>(...ALL_ROLES),
    validate(createSaleSchema),
    createSale,
);

router.get(
    "/",
    authorize<OrgRole>(...ALL_ROLES),
    validate(listSalesSchema),
    listSales,
);

// NOTE: /summary must come before /:saleId to avoid Express matching "summary" as a UUID
router.get(
    "/summary",
    authorize<OrgRole>(...MANAGERS),
    validate(salesSummarySchema),
    getSalesSummary,
);

router.get(
    "/:saleId",
    authorize<OrgRole>(...ALL_ROLES),
    validate(saleParamSchema),
    getSale,
);

router.patch(
    "/:saleId/approve",
    authorize<OrgRole>(...MANAGERS),
    validate(saleParamSchema),
    approveSale,
);

router.patch(
    "/:saleId/complete",
    authorize<OrgRole>(...MANAGERS),
    validate(saleParamSchema),
    completeSale,
);

router.patch(
    "/:saleId/cancel",
    authorize<OrgRole>(...MANAGERS),
    validate(cancelSaleSchema),
    cancelSale,
);

export default router;
