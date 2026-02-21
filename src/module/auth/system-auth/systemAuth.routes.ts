import { Router } from "express";
import { authRateLimiter } from "@/middlewares/rateLimiter.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  systemLoginSchema,
  systemRegisterSchema,
} from "./systemAuth.schema.js";
import { login, logout, logoutAll, register } from "./systemAuth.controller.js";
import { authenticate } from "@/middlewares/auth.middleware.js";

const router = Router();

router.post("/register", validate(systemRegisterSchema), register);
router.post("/login", validate(systemLoginSchema), login);
router.post("/logout", authenticate, logout);
router.post("/logout-all", authenticate, logoutAll);

export default router;
