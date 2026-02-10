import rateLimit from "express-rate-limit";
// import { RATE_LIMIT } from "../shared/constants/index.js";

// export const apiLimiter = rateLimit({
//   windowMs: RATE_LIMIT.WINDOW_MS,
//   max: RATE_LIMIT.MAX_REQUESTS,
//   message: "Too many requests from this IP, please try again later",
//   standardHeaders: true,
//   legacyHeaders: false,
// });

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: "Too many login attempts, please try again later",
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});
