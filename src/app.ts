import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
// import morgan from "morgan";
import helmet from "helmet";
import { env } from "./config/env.js";
import { httpLogger } from "./middlewares/logger.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { AppError } from "./utils/appError.js";
import authRouter from "./module/auth/org-auth/orgAuth.routes.js";
// import { errorMiddleware } from "./middlewares/error.middleware";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: "", // your frontend URL
    credentials: true,
  }),
);

app.use(express.json());
app.use(httpLogger);

// Helath cheack
app.get("/health", (_, res) => {
  res.json({ status: "OK", uptime: process.uptime() });
});

app.use("/api/v1/auth", authRouter);

// 404 handler
app.all("{/*path}", (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

app.use(errorMiddleware);

export default app;
