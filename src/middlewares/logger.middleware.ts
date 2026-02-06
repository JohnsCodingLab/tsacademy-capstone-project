import { pinoHttp } from "pino-http";
import { logger } from "../libs/logger.js";

export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (res, err) => {
    const statusCode = res.statusCode ?? 500;

    if (statusCode >= 500 || err) return "error";
    if (statusCode >= 400) return "warn";
    return "info";
  },
});
