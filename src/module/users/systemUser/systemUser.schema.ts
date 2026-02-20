import { z } from "zod";

// ─── Organization Management ──────────────────────────────────────────────────

export const listOrgsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    /** Filter by active/inactive status */
    isActive: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    /** Search by name */
    search: z.string().trim().optional(),
  }),
});

export const orgSlugParamSchema = z.object({
  params: z.object({
    orgSlug: z.string().min(2),
  }),
});

// ─── System User Management ───────────────────────────────────────────────────

export const listSysUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
  }),
});

export const sysUserIdParamSchema = z.object({
  params: z.object({
    userId: z.string("Invalid user ID"),
  }),
});

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type ListOrgsQueryDTO = z.infer<typeof listOrgsSchema>["query"];
export type ListSysUsersQueryDTO = z.infer<typeof listSysUsersSchema>["query"];
