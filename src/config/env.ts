import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
    // Server
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
    PORT: z.coerce.number().default(5000),
    FRONTEND_URL: z.string().default("http://localhost:3000"),

    // Database
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // JWT
    ORG_JWT_SECRET: z
        .string()
        .min(32, "ORG_JWT_SECRET must be at least 32 characters"),
    ORG_JWT_REFRESH_SECRET: z
        .string()
        .min(32, "ORG_JWT_REFRESH_SECRET must be at least 32 characters"),
    SYSTEM_JWT_SECRET: z
        .string()
        .min(32, "SYSTEM_JWT_SECRET must be at least 32 characters"),
    SYSTEM_JWT_REFRESH_SECRET: z
        .string()
        .min(32, "SYSTEM_JWT_REFRESH_SECRET must be at least 32 characters"),
    JWT_ACCESS_EXPIRATION: z.string().default("15m"),
    JWT_REFRESH_EXPIRATION: z.string().default("7d"),

    // Redis
    REDIS_URL: z.string().min(1, "REDIS_URL is required"),

    // SMTP (email)
    SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_SECURE: z
        .enum(["true", "false"])
        .transform((v) => v === "true")
        .default(false),
    SMTP_USER: z.string().min(1, "SMTP_USER is required"),
    SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
    SMTP_FROM: z.string().default("S.I.S.M.S <no-reply@sisms.com>"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error(
        "❌ Invalid environment variables:",
        parsedEnv.error.format(),
    );
    process.exit(1);
}

export const env = parsedEnv.data;
