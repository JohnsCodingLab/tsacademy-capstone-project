import { Redis } from "ioredis";
import { env } from "./env.js";
import { logger } from "../libs/logger.js";

export const redis = new Redis(env.REDIS_URL);

redis.on("connect", () => {
  logger.info("✅ Redis connected");
});

redis.on("error", (err: Error) => {
  logger.error(err, "❌ Redis error");
});

export const connectRedis = async () => {
  try {
    await redis.ping();
    logger.info("✅ Redis is ready");
  } catch (err) {
    logger.error(err as Error, "❌ Redis failed to connect");
  }
};
