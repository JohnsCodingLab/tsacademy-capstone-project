import { Worker, type Job } from "bullmq";
import nodemailer from "nodemailer";
import { env } from "@/config/env.js";
import { logger } from "@/libs/logger.js";
import {
    welcomeEmail,
    passwordChangedEmail,
    lowStockEmail,
    saleApprovedEmail,
} from "./email.templates.js";
import type { EmailJobMap, EmailJobName } from "./email.queue.js";

// ─── Nodemailer transporter ───────────────────────────────────────────────────
// Created once at worker startup — connection is pooled and reused.

const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
    pool: true, // reuse SMTP connections
    maxConnections: 5,
    maxMessages: 100,

    socketTimeout: 60_000,
    connectionTimeout: 60_000,
    greetingTimeout: 30_000,
});

// Verify SMTP connection at startup
transporter.verify((err) => {
    if (err) {
        logger.error(
            { err },
            "❌ SMTP connection failed — emails will not be sent",
        );
    } else {
        logger.info("✅ SMTP connection verified");
    }
});

// ─── Send helper ─────────────────────────────────────────────────────────────

async function sendMail(to: string | string[], subject: string, html: string) {
    await transporter.sendMail({
        from: env.SMTP_FROM,
        to: Array.isArray(to) ? to.join(", ") : to,
        subject,
        html,
    });
}

// ─── Job processor ────────────────────────────────────────────────────────────

async function processEmailJob(
    job: Job<EmailJobMap[EmailJobName], void, EmailJobName>,
) {
    logger.info({ jobId: job.id, jobName: job.name }, "Processing email job");

    switch (job.name) {
        case "send:welcome": {
            const data = job.data as EmailJobMap["send:welcome"];
            const { subject, html } = welcomeEmail({
                recipientName: data.recipientName,
                organizationName: data.organizationName,
                email: data.email,
                temporaryPassword: data.temporaryPassword,
                loginUrl: data.loginUrl,
                role: data.role,
            });
            await sendMail(data.to, subject, html);
            break;
        }

        case "send:password-changed": {
            const data = job.data as EmailJobMap["send:password-changed"];
            const { subject, html } = passwordChangedEmail({
                recipientName: data.recipientName,
                ipAddress: data.ipAddress,
                timestamp: data.timestamp,
                loginUrl: data.loginUrl,
            });
            await sendMail(data.to, subject, html);
            break;
        }

        case "send:low-stock": {
            const data = job.data as EmailJobMap["send:low-stock"];
            const { subject, html } = lowStockEmail({
                organizationName: data.organizationName,
                products: data.products,
                alertsUrl: data.alertsUrl,
            });
            await sendMail(data.to, subject, html);
            break;
        }

        case "send:sale-approved": {
            const data = job.data as EmailJobMap["send:sale-approved"];
            const { subject, html } = saleApprovedEmail({
                recipientName: data.recipientName,
                saleId: data.saleId,
                totalAmount: data.totalAmount,
                itemCount: data.itemCount,
                approvedByName: data.approvedByName,
                currency: data.currency,
                saleUrl: data.saleUrl,
            });
            await sendMail(data.to, subject, html);
            break;
        }

        default:
            logger.warn(
                { jobName: job.name },
                "Unknown email job type — skipping",
            );
    }

    logger.info({ jobId: job.id, jobName: job.name }, "Email job completed");
}

// ─── Worker bootstrap ─────────────────────────────────────────────────────────

type EmailWorker = Worker<EmailJobMap[EmailJobName], void, EmailJobName>;

export function startEmailWorker(): EmailWorker {
    const worker = new Worker("email", processEmailJob, {
        connection: { url: env.REDIS_URL },
        concurrency: 5, // process up to 5 email jobs in parallel
        limiter: {
            max: 50, // max 50 emails per
            duration: 60_000, // per minute — stay within SMTP provider rate limits
        },
    });

    worker.on("completed", (job) => {
        logger.info({ jobId: job.id, jobName: job.name }, "✅ Email sent");
    });

    worker.on("failed", (job, err) => {
        logger.error(
            {
                jobId: job?.id,
                jobName: job?.name,
                err,
                attempts: job?.attemptsMade,
            },
            "❌ Email job failed",
        );
    });

    worker.on("error", (err) => {
        logger.error({ err }, "Email worker error");
    });

    logger.info("📧 Email worker started");
    return worker;
}
