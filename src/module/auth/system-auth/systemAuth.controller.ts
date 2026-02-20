import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { SysAuthService } from "./systemAuth.service.js";
import type { RegisterSystemUserDTO } from "./systemAuth.schema.js";
import { sendSuccess } from "@/utils/response.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await SysAuthService.register(req.body as RegisterSystemUserDTO);
  sendSuccess(res, { user }, 201, "System user registered successfully");
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await SysAuthService.login(
    { email, password },
    {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    },
  );

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

  await SysAuthService.logout(req.user!.id, refreshToken);

  res.clearCookie("refreshToken");

  sendSuccess(res, null, 200, "Logged out successfully");
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  await SysAuthService.logoutAll(req.user!.id);

  res.clearCookie("refreshToken");

  sendSuccess(res, null, 200, "Logged out from all devices");
});
