import type { Response } from "express";
import { logger } from "@/libs/logger.js";

// ─── Event types ──────────────────────────────────────────────────────────────

export type SSEEventName =
    | "stock.adjusted"
    | "stock.low"
    | "sale.created"
    | "sale.approved"
    | "sale.completed"
    | "sale.cancelled"
    | "forecast.updated"
    | "ping"; // heartbeat to keep connections alive

export interface SSEPayload {
    event: SSEEventName;
    data: Record<string, unknown>;
    timestamp: string;
}

// ─── SSE Manager ──────────────────────────────────────────────────────────────

/**
 * Singleton that tracks all active SSE connections grouped by organizationId.
 *
 * Architecture:
 *   connections: Map<orgId, Set<Response>>
 *
 * Each Response in the Set is a long-lived HTTP response that has been
 * configured for SSE streaming. The Set is cleaned up automatically
 * when a client disconnects.
 */
class SSEManagerClass {
    private connections = new Map<string, Set<Response>>();
    private pingInterval: NodeJS.Timeout | null = null;

    // ── Connect ─────────────────────────────────────────────────────────────────

    /**
     * Register a new SSE client connection for an org.
     * Sends the initial connection event and sets up cleanup on disconnect.
     */
    connect(orgId: string, res: Response): void {
        // SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
        res.flushHeaders();

        // Register the connection
        if (!this.connections.has(orgId)) {
            this.connections.set(orgId, new Set());
        }
        this.connections.get(orgId)!.add(res);

        const count = this.connections.get(orgId)!.size;
        logger.info(
            { orgId, activeConnections: count },
            "SSE client connected",
        );

        // Send initial connected event so the client knows it's live
        this.send(res, {
            event: "ping",
            data: { message: "connected", orgId },
            timestamp: new Date().toISOString(),
        });

        // Cleanup on disconnect
        res.on("close", () => {
            this.disconnect(orgId, res);
        });
    }

    // ── Disconnect ──────────────────────────────────────────────────────────────

    private disconnect(orgId: string, res: Response): void {
        const orgConnections = this.connections.get(orgId);
        if (!orgConnections) return;

        orgConnections.delete(res);

        if (orgConnections.size === 0) {
            this.connections.delete(orgId);
        }

        logger.info(
            { orgId, remaining: orgConnections.size },
            "SSE client disconnected",
        );
    }

    // ── Send to one client ───────────────────────────────────────────────────────

    private send(res: Response, payload: SSEPayload): void {
        try {
            // SSE wire format: "event: <name>\ndata: <json>\n\n"
            res.write(`event: ${payload.event}\n`);
            res.write(
                `data: ${JSON.stringify({ ...payload.data, timestamp: payload.timestamp })}\n\n`,
            );
        } catch {
            // Connection was likely already closed — ignore
        }
    }

    // ── Broadcast to org ────────────────────────────────────────────────────────

    /**
     * Push an event to every connected client in the organization.
     * Safe to call from anywhere — if no clients are connected it's a no-op.
     */
    broadcast(
        orgId: string,
        event: SSEEventName,
        data: Record<string, unknown>,
    ): void {
        const orgConnections = this.connections.get(orgId);
        if (!orgConnections || orgConnections.size === 0) return;

        const payload: SSEPayload = {
            event,
            data,
            timestamp: new Date().toISOString(),
        };

        let dead = 0;
        for (const res of orgConnections) {
            if (res.writableEnded) {
                // Stale connection — remove it
                orgConnections.delete(res);
                dead++;
                continue;
            }
            this.send(res, payload);
        }

        if (dead > 0) {
            logger.debug(
                { orgId, removed: dead },
                "Cleaned up stale SSE connections",
            );
        }

        logger.debug(
            { orgId, event, clients: orgConnections.size },
            "SSE broadcast sent",
        );
    }

    // ── Heartbeat ────────────────────────────────────────────────────────────────

    /**
     * Start sending periodic ping events to all clients.
     * This prevents proxies and load balancers from closing idle connections.
     * Call once at server startup.
     */
    startHeartbeat(intervalMs = 25_000): void {
        if (this.pingInterval) return;

        this.pingInterval = setInterval(() => {
            const timestamp = new Date().toISOString();
            for (const [orgId, clients] of this.connections) {
                for (const res of clients) {
                    if (res.writableEnded) {
                        clients.delete(res);
                        continue;
                    }
                    try {
                        res.write(
                            `event: ping\ndata: ${JSON.stringify({ timestamp })}\n\n`,
                        );
                    } catch {
                        clients.delete(res);
                    }
                }
                if (clients.size === 0) this.connections.delete(orgId);
            }
        }, intervalMs);

        logger.info({ intervalMs }, "SSE heartbeat started");
    }

    stopHeartbeat(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    // ── Stats ────────────────────────────────────────────────────────────────────

    stats() {
        const result: Record<string, number> = {};
        for (const [orgId, clients] of this.connections) {
            result[orgId] = clients.size;
        }
        return result;
    }
}

// Export singleton
export const SSEManager = new SSEManagerClass();
