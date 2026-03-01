import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { sendSuccess } from "@/utils/response.js";
import { SalesService } from "./sales.service.js";
import { ActivityService, ActivityAction } from "@/libs/activity.service.js";
import type {
    CreateSaleDTO,
    ListSalesQueryDTO,
    CancelSaleDTO,
    SalesSummaryQueryDTO,
} from "./sales.schema.js";
import type { OrgRole } from "@/generated/prisma/index.js";
import type { SaleParams } from "@/types/types.js";

// ─── Helper ───────────────────────────────────────────────────────────────────

const getOrgContext = (req: Request) => {
    if (req.user?.type !== "ORG") throw new Error("Expected ORG user context");
    return {
        callerId: req.user.id,
        callerRole: req.user.role as OrgRole,
        orgId: req.org!.id,
    };
};

// ─── Controllers ──────────────────────────────────────────────────────────────

export const createSale = asyncHandler(async (req: Request, res: Response) => {
    const { orgId, callerId } = getOrgContext(req);
    const sale = await SalesService.createSale(
        orgId,
        req.body as CreateSaleDTO,
        callerId,
    );

    ActivityService.log({
        userId: callerId,
        action: ActivityAction.SALE_CREATED,
        metadata: {
            saleId: sale.id,
            totalAmount: sale.totalAmount,
            itemCount: sale.items.length,
        },
        req,
    });

    sendSuccess(res, { sale }, 201, "Sale created — awaiting approval");
});

export const listSales = asyncHandler(async (req: Request, res: Response) => {
    const { orgId, callerId, callerRole } = getOrgContext(req);
    const result = await SalesService.listSales(
        orgId,
        callerId,
        callerRole,
        req.query as unknown as ListSalesQueryDTO,
        req,
    );
    sendSuccess(res, result.data, 200, "Sales fetched", result.meta);
});

export const getSale = asyncHandler(
    async (req: Request<SaleParams>, res: Response) => {
        const { orgId, callerId, callerRole } = getOrgContext(req);
        const sale = await SalesService.getSale(
            orgId,
            req.params.saleId,
            callerId,
            callerRole,
        );
        sendSuccess(res, { sale }, 200);
    },
);

export const approveSale = asyncHandler(
    async (req: Request<SaleParams>, res: Response) => {
        const { orgId, callerId } = getOrgContext(req);
        const sale = await SalesService.approveSale(
            orgId,
            req.params.saleId,
            callerId,
        );

        ActivityService.log({
            userId: callerId,
            action: ActivityAction.SALE_APPROVED,
            metadata: { saleId: sale.id, totalAmount: sale.totalAmount },
            req,
        });

        sendSuccess(res, { sale }, 200, "Sale approved — stock committed");
    },
);

export const completeSale = asyncHandler(
    async (req: Request<SaleParams>, res: Response) => {
        const { orgId, callerId } = getOrgContext(req);
        const sale = await SalesService.completeSale(
            orgId,
            req.params.saleId,
            callerId,
        );

        ActivityService.log({
            userId: callerId,
            action: ActivityAction.SALE_COMPLETED,
            metadata: { saleId: sale.id },
            req,
        });

        sendSuccess(res, { sale }, 200, "Sale completed");
    },
);

export const cancelSale = asyncHandler(
    async (req: Request<SaleParams>, res: Response) => {
        const { orgId, callerId } = getOrgContext(req);
        const sale = await SalesService.cancelSale(
            orgId,
            req.params.saleId,
            req.body as CancelSaleDTO,
            callerId,
        );

        ActivityService.log({
            userId: callerId,
            action: ActivityAction.SALE_CANCELLED,
            metadata: {
                saleId: sale.id,
                cancellationNote: req.body.cancellationNote,
                stockReturned: sale.approvedAt !== null,
            },
            req,
        });

        sendSuccess(res, { sale }, 200, "Sale cancelled");
    },
);

export const getSalesSummary = asyncHandler(
    async (req: Request, res: Response) => {
        const { orgId } = getOrgContext(req);
        const summary = await SalesService.getSalesSummary(
            orgId,
            req.query as unknown as SalesSummaryQueryDTO,
        );
        sendSuccess(res, { summary }, 200, "Sales summary computed");
    },
);
