import { Router } from "express";
import { authRateLimiter } from "@/middlewares/rateLimiter.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  systemLoginSchema,
  systemRegisterSchema,
} from "./systemAuth.schema.js";
import { login, register } from "./systemAuth.controller.js";

const router = Router();

router.post("/register-system-user", validate(systemRegisterSchema), register);
router.post("/login", validate(systemLoginSchema), login);

export default router;
