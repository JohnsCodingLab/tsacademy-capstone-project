import { Router } from "express";
import type { Request, Response } from "express";
import { authenticate } from "@/middlewares/auth.middleware.js";
import { requireOrgAccess } from "@/middlewares/orgAccess.middleware.js";
import { SSEManager } from "@/libs/sse/sse.manager.js";
import { AppError } from "@/utils/appError.js";

const router = Router({ mergeParams: true });

/**
 * GET /api/v1/orgs/:orgSlug/events
 *
 * Establishes a Server-Sent Events stream for the authenticated org user.
 * The client will receive real-time events for:
 *   - stock.adjusted  → any stock movement (IN or OUT)
 *   - stock.low       → product fell at or below its reorder point
 *   - sale.created    → new sale raised
 *   - sale.approved   → sale approved, stock committed
 *   - sale.completed  → sale marked complete
 *   - sale.cancelled  → sale cancelled (stock returned if was approved)
 *   - forecast.updated → stock change that affects sales velocity
 *   - ping            → heartbeat every 25s to keep the connection alive
 *
 * Client-side usage (browser):
 *   const es = new EventSource("/api/v1/orgs/acme-corp/events", {
 *     headers: { Authorization: "Bearer <token>" }
 *   });
 *   es.addEventListener("stock.low", (e) => console.log(JSON.parse(e.data)));
 *
 * Note: EventSource doesn't support custom headers in all browsers.
 * Pass the token as a query param instead for broader compatibility:
 *   GET /api/v1/orgs/:orgSlug/events?token=<accessToken>
 */
router.get(
    "/",
    authenticate,
    requireOrgAccess,
    (req: Request, res: Response) => {
        if (req.user?.type !== "ORG") {
            throw new AppError(
                "Only org users can subscribe to org events",
                403,
            );
        }

        const orgId = req.org!.id;
        SSEManager.connect(orgId, res);

        // SSE connections are kept open — Express must not call next()
    },
);

export default router;
