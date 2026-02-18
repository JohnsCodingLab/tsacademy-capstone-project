import { Router } from "express";
import { authRateLimiter } from "@/middlewares/rateLimiter.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import { loginOrgSchema, registerOrgSchema } from "./orgAuth.schema.js";
import { login, logout, logoutAll, register } from "./orgAuth.controller.js";
import { authenticate } from "@/middlewares/auth.middleware.js";

const router = Router();

router.post(
  "/register",
  authRateLimiter,
  validate(registerOrgSchema),
  register,
);
router.post("/login", validate(loginOrgSchema), login);
router.post("/logout", authenticate, logout);
router.post("/logout-all", authenticate, logoutAll);

export default router;
