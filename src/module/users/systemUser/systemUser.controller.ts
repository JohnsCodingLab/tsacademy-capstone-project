import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { sendSuccess } from "@/utils/response.js";
import { SysUsersService } from "./systemUser.service.js";
import type {
  ListOrgsQueryDTO,
  ListSysUsersQueryDTO,
} from "./systemUser.schema.js";
import type { OrgRouteParams, SysUserParams } from "@/types/types.js";

// ─── Organization Controllers ─────────────────────────────────────────────────

export const listOrgs = asyncHandler(async (req: Request, res: Response) => {
  const result = await SysUsersService.listOrgs(
    req.query as unknown as ListOrgsQueryDTO,
    req,
  );
  sendSuccess(res, result.data, 200, "Organizations fetched", result.meta);
});

export const getOrg = asyncHandler(
  async (req: Request<OrgRouteParams>, res: Response) => {
    const org = await SysUsersService.getOrg(req.params.orgSlug);
    sendSuccess(res, { org }, 200);
  },
);

export const deactivateOrg = asyncHandler(
  async (req: Request<OrgRouteParams>, res: Response) => {
    await SysUsersService.deactivateOrg(req.params.orgSlug, req.user!.id);
    sendSuccess(res, null, 200, "Organization deactivated successfully");
  },
);

export const reactivateOrg = asyncHandler(
  async (req: Request<OrgRouteParams>, res: Response) => {
    await SysUsersService.reactivateOrg(req.params.orgSlug, req.user!.id);
    sendSuccess(res, null, 200, "Organization reactivated successfully");
  },
);

// ─── System User Controllers ──────────────────────────────────────────────────

export const listSysUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await SysUsersService.listSysUsers(
      req.query as unknown as ListSysUsersQueryDTO,
      req,
    );
    sendSuccess(res, result.data, 200, "System users fetched", result.meta);
  },
);

export const getSysUser = asyncHandler(
  async (req: Request<SysUserParams>, res: Response) => {
    const user = await SysUsersService.getSysUser(req.params.userId);
    sendSuccess(res, { user }, 200);
  },
);

export const deactivateSysUser = asyncHandler(
  async (req: Request<SysUserParams>, res: Response) => {
    await SysUsersService.deactivateSysUser(req.params.userId, req.user!.id);
    sendSuccess(res, null, 200, "System user deactivated");
  },
);

export const deleteSysUser = asyncHandler(
  async (req: Request<SysUserParams>, res: Response) => {
    await SysUsersService.deleteSysUser(req.params.userId, req.user!.id);
    sendSuccess(res, null, 200, "System user deleted permanently");
  },
);
