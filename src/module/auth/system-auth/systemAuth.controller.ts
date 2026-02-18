import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { SysAuthService } from "./systemAuth.service.js";
import type { RegisterSystemUserDTO } from "./systemAuth.schema.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, role } = req.body;
  const user = await SysAuthService.register(req.body as RegisterSystemUserDTO);
  res.status(201).json({
    status: "Registration successful",
    user: user,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { orgSlug, email, password } = req.body;
  const result = await SysAuthService.login(
    { email, password },
    {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    },
  );

  res.cookie("refreshToken", result.tokens.refreshToken, {
    httpOnly: true,
    secure: false, //set to true when process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    status: "login successful",
    user: result.user,
    token: result.tokens.accessToken,
  });
});
