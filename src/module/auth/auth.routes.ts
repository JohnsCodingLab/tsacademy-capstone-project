import { Router } from "express";
import { authRateLimiter } from "@/middlewares/rateLimiter.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import { loginSchema, registerSchema } from "./auth.schema.js";
import { login, register } from "./auth.controller.js";

const router = Router();

router.post("/register", authRateLimiter, validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);

export default router;
