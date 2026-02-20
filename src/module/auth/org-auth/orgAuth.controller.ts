import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { OrgAuthService } from "./orgAuth.service.js";
import type { LoginOrgUserDTO, RegisterOrgUserDTO } from "./orgAuth.schema.js";
import { sendSuccess } from "@/utils/response.js";
import { ActivityAction, ActivityService } from "@/libs/activity.service.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, role } = req.body;
  const user = await OrgAuthService.registerOrg(req.body as RegisterOrgUserDTO);

  sendSuccess(res, { user }, 201, "Organization registered successfully");
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { orgSlug } = req.body;
  const result = await OrgAuthService.login(
    req.body as LoginOrgUserDTO,
    orgSlug,
    {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    },
  );

  ActivityService.log({
    userId: result.user.id,
    action: ActivityAction.LOGIN,
    metadata: { orgSlug },
    req,
  });

  res.cookie("refreshToken", result.tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", //set to true when process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  sendSuccess(
    res,
    { user: result.user, accessToken: result.tokens.accessToken },
    200,
    "Login successful",
  );
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  await OrgAuthService.logout(req.user!.id, refreshToken);

  ActivityService.log({
    userId: req.user!.id,
    action: ActivityAction.LOGOUT,
    req,
  });

  res.clearCookie("refreshToken");

  sendSuccess(res, null, 200, "Logged out successfully");
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  await OrgAuthService.logoutAll(req.user!.id);

  ActivityService.log({
    userId: req.user!.id,
    action: ActivityAction.LOGOUT_ALL,
    req,
  });

  res.clearCookie("refreshToken");

  sendSuccess(res, null, 200, "Logged out from all devices");
});
