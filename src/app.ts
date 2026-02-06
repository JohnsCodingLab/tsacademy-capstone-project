import express from "express";
import cors from "cors";
// import morgan from "morgan";
import helmet from "helmet";
import { env } from "./config/env.js";
import { httpLogger } from "./middlewares/logger.middleware.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
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

app.use(errorMiddleware);

export default app;
