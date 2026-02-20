import type { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/appError.js";
import prisma from "@/config/prisma.js";
import { asyncHandler } from "@/utils/asyncHandler.js";

/**
 * `requireOrgAccess` — Org-scoping middleware.
 *
 * Attaches the resolved organization to `req.org` and enforces that the
 * authenticated OrgUser actually belongs to the organization identified by
 * `:orgSlug` in the route params.
 *
 * **Must** be used after `authenticate` on any route that is org-scoped.
 *
 * ─── What it does ────────────────────────────────────────────────────────────
 *  1. Reads `:orgSlug` from `req.params`.
 *  2. Looks up the organization in the DB (cheap indexed query).
 *  3. Verifies the token's `orgId` matches the org found — preventing
 *     a user from org-A from hitting org-B's endpoints.
 *  4. Attaches `req.org` so downstream handlers don't re-fetch it.
 *
 * System users (`type === "SYSTEM"`) bypass the membership check entirely —
 * they have platform-wide access.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 * @example
 * // In a router:
 * router.get(
 *   "/orgs/:orgSlug/users",
 *   authenticate,
 *   requireOrgAccess,
 *   authorize<OrgRole>("ORG_SUPER_ADMIN", "ORG_ADMIN"),
 *   listUsers,
 * );
 */
export const requireOrgAccess = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const { orgSlug } = req.params;

    if (!orgSlug || typeof orgSlug !== "string") {
      return next(new AppError("Missing :orgSlug route parameter", 400));
    }

    // Resolve the org from the slug (indexed column — fast)
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true, name: true, slug: true, isActive: true },
    });

    if (!org) {
      return next(new AppError("Organization not found", 404));
    }

    if (!org.isActive) {
      return next(new AppError("Organization is deactivated", 403));
    }

    // System users have platform-wide access — skip membership check
    if (req.user?.type === "SYSTEM") {
      req.org = org;
      return next();
    }

    // OrgUser: verify they belong to this specific org
    if (req.user?.type === "ORG") {
      if (req.user.orgId !== org.id) {
        return next(
          new AppError(
            "Forbidden: You do not belong to this organization",
            403,
          ),
        );
      }
      req.org = org;
      return next();
    }

    // Should never reach here if authenticate ran first
    return next(new AppError("Authentication required", 401));
  },
);

// ─── Extend Express Request ───────────────────────────────────────────────────

/**
 * The resolved org is attached by `requireOrgAccess` so controllers
 * can use it without an extra DB round-trip.
 */
declare global {
  namespace Express {
    interface Request {
      org?: {
        id: string;
        name: string;
        slug: string;
        isActive: boolean;
      };
    }
  }
}
