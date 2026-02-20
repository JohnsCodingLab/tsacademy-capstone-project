import { Router } from "express";
import { authenticate } from "@/middlewares/auth.middleware.js";
import { authorize } from "@/middlewares/rbac.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  listOrgsSchema,
  orgSlugParamSchema,
  listSysUsersSchema,
  sysUserIdParamSchema,
} from "./systemUser.schema.js";
import {
  listOrgs,
  getOrg,
  deactivateOrg,
  reactivateOrg,
  listSysUsers,
  getSysUser,
  deactivateSysUser,
  deleteSysUser,
} from "./systemUser.controller.js";
import type { SystemRole } from "@/generated/prisma/index.js";

const router = Router();

// All routes in this module require a valid SYSTEM token
router.use(authenticate, authorize<SystemRole>("SYSTEM_ADMIN"));

// ─── Organization Management ──────────────────────────────────────────────────
// GET  /api/v1/sys/orgs                     → list all orgs (paginated)
// GET  /api/v1/sys/orgs/:orgSlug            → get org detail + users
// PATCH /api/v1/sys/orgs/:orgSlug/deactivate → soft-disable org + its users
// PATCH /api/v1/sys/orgs/:orgSlug/activate   → re-enable org

router.get("/orgs", validate(listOrgsSchema), listOrgs);
router.get("/orgs/:orgSlug", validate(orgSlugParamSchema), getOrg);
router.patch(
  "/orgs/:orgSlug/deactivate",
  validate(orgSlugParamSchema),
  deactivateOrg,
);
router.patch(
  "/orgs/:orgSlug/activate",
  validate(orgSlugParamSchema),
  reactivateOrg,
);

// ─── System User Management ───────────────────────────────────────────────────
// GET    /api/v1/sys/users           → list all system users (paginated)
// GET    /api/v1/sys/users/:userId   → get single system user
// PATCH  /api/v1/sys/users/:userId/deactivate → deactivate (cannot self-target)
// DELETE /api/v1/sys/users/:userId   → hard delete (cannot self-target)

router.get("/users", validate(listSysUsersSchema), listSysUsers);
router.get("/users/:userId", validate(sysUserIdParamSchema), getSysUser);
router.patch(
  "/users/:userId/deactivate",
  validate(sysUserIdParamSchema),
  deactivateSysUser,
);
router.delete("/users/:userId", validate(sysUserIdParamSchema), deleteSysUser);

export default router;
