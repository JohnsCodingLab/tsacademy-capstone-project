import type { Request, Response } from "express";
import type { LoginUserDTO, RegisterUserDTO } from "./auth.schema.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { AuthService } from "./auth.service.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, role } = req.body;
  const user = await AuthService.register(req.body as RegisterUserDTO);

  res.status(201).json({
    status: "Registration successful",
    data: user,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.login(req.body as LoginUserDTO, {
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.cookie("refreshToken", result.tokens.refreshToken, {
    httpOnly: true,
    secure: false, //set to true when process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    status: "login successful",
    user: result.user,
    data: result.tokens.accessToken,
  });
});
