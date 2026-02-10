import { Router } from "express";
import { authRateLimiter } from "@/middlewares/rateLimiter.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import { loginOrgSchema, registerOrgSchema } from "./orgAuth.schema.js";
import { login, register } from "./orgAuth.controller.js";

const router = Router();

router.post(
  "/register",
  authRateLimiter,
  validate(registerOrgSchema),
  register,
);
router.post("/login", validate(loginOrgSchema), login);

export default router;
