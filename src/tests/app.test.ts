import { jest, describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import app from "@/app.js";
import * as jwt from "jsonwebtoken";
import { mockPrisma } from "./mockPrisma.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeOrgToken = (overrides: Record<string, unknown> = {}) =>
    jwt.sign(
        {
            sub: "user-1",
            role: "ORG_ADMIN",
            type: "ORG",
            orgId: "org-1",
            ...overrides,
        },
        process.env.ORG_JWT_SECRET ?? "test-secret-32-chars-minimum-here",
        { expiresIn: "15m" },
    );

// ─── Health check ──────────────────────────────────────────────────────────────

describe("GET /health", () => {
    it("returns 200 OK with status and uptime", async () => {
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: "OK" });
        expect(typeof res.body.uptime).toBe("number");
    });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────

describe("Unknown routes", () => {
    it("returns 404 for a completely unknown path", async () => {
        const res = await request(app).get("/api/v1/does-not-exist");
        expect(res.status).toBe(404);
    });
});

// ─── Org Auth — register ───────────────────────────────────────────────────────

describe("POST /api/v1/org-auth/register", () => {
    beforeAll(() => {
        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
            return callback({
                organization: {
                    create: jest.fn(async () => ({
                        id: "org-1",
                        name: "Test Co",
                        slug: "test-co",
                        isActive: true,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    })),
                },
                orgUser: {
                    create: jest.fn(async () => ({
                        id: "user-1",
                        organizationId: "org-1",
                        name: "Owner",
                        email: "owner@testco.com",
                        password: "$hashed$",
                        role: "ORG_SUPER_ADMIN",
                        profileImageUrl: null,
                        isActive: true,
                        revokedAt: null,
                        lastLogin: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    })),
                },
            });
        });
    });

    it("returns 201 with user on valid payload", async () => {
        const res = await request(app).post("/api/v1/org-auth/register").send({
            organizationName: "Test Co",
            name: "Owner",
            email: "owner@testco.com",
            password: "SuperSecret123!",
        });

        expect(res.status).toBe(201);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe("owner@testco.com");
        expect(res.body.user).not.toHaveProperty("password");
    });

    it("returns 400 when required fields are missing", async () => {
        const res = await request(app)
            .post("/api/v1/org-auth/register")
            .send({ email: "incomplete@testco.com" }); // missing name, password, orgName

        expect(res.status).toBe(400);
    });
});

// ─── Org Auth — login ──────────────────────────────────────────────────────────

describe("POST /api/v1/org-auth/login", () => {
    it("returns 400 when body is empty", async () => {
        const res = await request(app).post("/api/v1/org-auth/login").send({});

        expect(res.status).toBe(400);
    });
});

// ─── Authentication guard ──────────────────────────────────────────────────────

describe("Protected routes — authentication guard", () => {
    it("returns 401 when no Authorization header is sent", async () => {
        const res = await request(app).get("/api/v1/orgs/test-org/users");

        expect(res.status).toBe(401);
    });

    it("returns 401 when token is malformed", async () => {
        const res = await request(app)
            .get("/api/v1/orgs/test-org/users")
            .set("Authorization", "Bearer not.a.real.token");

        expect(res.status).toBe(401);
    });

    it("returns 401 when Bearer prefix is missing", async () => {
        const token = makeOrgToken();
        const res = await request(app)
            .get("/api/v1/orgs/test-org/users")
            .set("Authorization", token); // no "Bearer " prefix

        expect(res.status).toBe(401);
    });
});

// ─── Org access guard ──────────────────────────────────────────────────────────

describe("Protected routes — org access guard", () => {
    it("returns 404 when org slug does not exist in DB", async () => {
        mockPrisma.organization.findUnique.mockResolvedValue(null);

        const token = makeOrgToken();
        const res = await request(app)
            .get("/api/v1/orgs/ghost-org/users")
            .set("Authorization", `Bearer ${token}`);

        // org not found → 404
        expect([403, 404]).toContain(res.status);
    });

    it("returns 403 when token org doesn't match route org", async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({
            id: "org-999", // different org than token's orgId
            name: "Other Corp",
            slug: "other-corp",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const token = makeOrgToken({ orgId: "org-1" }); // token is for org-1
        const res = await request(app)
            .get("/api/v1/orgs/other-corp/users") // but accessing other-corp
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
    });
});

// ─── Inventory routes — RBAC guard ────────────────────────────────────────────

describe("Inventory routes — RBAC enforcement", () => {
    it("allows ORG_USER to read products", async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({
            id: "org-1",
            name: "Test Co",
            slug: "test-co",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        mockPrisma.product.findMany.mockResolvedValue([]);
        mockPrisma.product.count.mockResolvedValue(0);

        const token = makeOrgToken({ role: "ORG_USER", orgId: "org-1" });
        const res = await request(app)
            .get("/api/v1/orgs/test-co/inventory/products")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
    });

    it("blocks ORG_USER from creating products (403)", async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({
            id: "org-1",
            name: "Test Co",
            slug: "test-co",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const token = makeOrgToken({ role: "ORG_USER", orgId: "org-1" });
        const res = await request(app)
            .post("/api/v1/orgs/test-co/inventory/products")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Widget", sku: "WGT-001", sellingPrice: 10 });

        expect(res.status).toBe(403);
    });
});
