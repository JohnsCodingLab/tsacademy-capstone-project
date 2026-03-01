import app from "./app.js";
import connectDB from "./config/database.js";
import { env } from "./config/env.js";
import { connectRedis } from "./config/redis.js";
import { startEmailWorker } from "./libs/emails/email.worker.js";
import { SSEManager } from "./libs/sse/sse.manager.js";

const startServer = async (): Promise<void> => {
    try {
        await connectDB();
        await connectRedis();

        // ── Background workers ──────────────────────────────────────────────────
        // Email worker: picks up jobs from Redis queue and sends via SMTP.
        startEmailWorker();

        // SSE heartbeat: pings all connected clients every 25s to prevent
        // proxies and load balancers from closing idle connections.
        SSEManager.startHeartbeat(25_000);

        const server = app.listen(env.PORT, () => {
            console.log(`🚀 Server running on port ${env.PORT}`);
            console.log(
                `📄 API docs:  http://localhost:${env.PORT}/api/v1/docs`,
            );
            console.log(`❤️  Health:    http://localhost:${env.PORT}/health`);
        });

        const shutdown = (signal: string) => {
            console.log(`\n${signal} received — shutting down gracefully`);
            SSEManager.stopHeartbeat();
            server.close(() => {
                console.log("HTTP server closed");
                process.exit(0);
            });
            // Force exit after 10 seconds if graceful shutdown stalls
            setTimeout(() => process.exit(1), 10_000);
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

        server.on("error", (error) => {
            console.error("❌ Server error:", error);
            process.exit(1);
        });
    } catch (error) {
        console.error("❌ Startup failed:", error);
        process.exit(1);
    }
};

startServer();
