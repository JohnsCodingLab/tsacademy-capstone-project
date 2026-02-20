import { Router } from "express";
import { authenticate } from "@/middlewares/auth.middleware.js";
import { authorize } from "@/middlewares/rbac.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  listOrgUsersSchema,
  createOrgUserSchema,
  updateOrgUserSchema,
  orgUserParamsSchema,
  orgSlugOnlyParamSchema,
  changePasswordSchema,
} from "./orgUser.schema.js";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
  reactivateUser,
  deleteUser,
  getUserActivity,
  getMe,
  changePassword,
} from "./orgUser.controller.js";
import type { OrgRole } from "@/generated/prisma/index.js";
import { requireOrgAccess } from "@/middlewares/orgAccess..middleware.js";

const router = Router({ mergeParams: true }); // mergeParams so :orgSlug is visible here

// All org-user routes require authentication + org membership
router.use(authenticate, requireOrgAccess);

// ─── Self (any authenticated org user) ───────────────────────────────────────
// GET   /api/v1/orgs/:orgSlug/users/me                → get own profile
// PATCH /api/v1/orgs/:orgSlug/users/me/change-password → change own password

router.get("/me", getMe);
router.patch(
  "/me/change-password",
  validate(changePasswordSchema),
  changePassword,
);

// ─── User Management (ORG_ADMIN + ORG_SUPER_ADMIN) ───────────────────────────
// GET  /api/v1/orgs/:orgSlug/users            → list users in org
// POST /api/v1/orgs/:orgSlug/users            → create / invite a new user
// GET  /api/v1/orgs/:orgSlug/users/:userId    → get a user's profile
// PUT  /api/v1/orgs/:orgSlug/users/:userId    → update a user's profile / role
// GET  /api/v1/orgs/:orgSlug/users/:userId/activity → view user activity log

router.get(
  "/",
  authorize<OrgRole>("ORG_SUPER_ADMIN", "ORG_ADMIN", "ORG_USER"),
  validate(listOrgUsersSchema),
  listUsers,
);

router.post(
  "/",
  authorize<OrgRole>("ORG_SUPER_ADMIN", "ORG_ADMIN"),
  validate(createOrgUserSchema),
  createUser,
);

router.get(
  "/:userId",
  authorize<OrgRole>("ORG_SUPER_ADMIN", "ORG_ADMIN", "ORG_USER"),
  validate(orgUserParamsSchema),
  getUser,
);

router.patch(
  "/:userId",
  authorize<OrgRole>("ORG_SUPER_ADMIN", "ORG_ADMIN"),
  validate(updateOrgUserSchema),
  updateUser,
);

router.get(
  "/:userId/activity",
  authorize<OrgRole>("ORG_SUPER_ADMIN", "ORG_ADMIN", "ORG_USER"),
  validate(orgUserParamsSchema),
  getUserActivity,
);

// ─── Deactivate / Reactivate / Delete (ORG_SUPER_ADMIN only for delete) ──────
// PATCH  /api/v1/orgs/:orgSlug/users/:userId/deactivate
// PATCH  /api/v1/orgs/:orgSlug/users/:userId/reactivate
// DELETE /api/v1/orgs/:orgSlug/users/:userId

router.patch(
  "/:userId/deactivate",
  authorize<OrgRole>("ORG_SUPER_ADMIN", "ORG_ADMIN"),
  validate(orgUserParamsSchema),
  deactivateUser,
);

router.patch(
  "/:userId/reactivate",
  authorize<OrgRole>("ORG_SUPER_ADMIN", "ORG_ADMIN"),
  validate(orgUserParamsSchema),
  reactivateUser,
);

router.delete(
  "/:userId",
  authorize<OrgRole>("ORG_SUPER_ADMIN"),
  validate(orgUserParamsSchema),
  deleteUser,
);

export default router;
