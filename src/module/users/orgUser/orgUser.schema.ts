import { z } from "zod";

// ─── Shared param schemas ─────────────────────────────────────────────────────

export const orgUserParamsSchema = z.object({
  params: z.object({
    orgSlug: z.string().min(2),
    userId: z.string("Invalid user ID"),
  }),
});

export const orgSlugOnlyParamSchema = z.object({
  params: z.object({
    orgSlug: z.string().min(2),
  }),
});

// ─── List users ───────────────────────────────────────────────────────────────

export const listOrgUsersSchema = z.object({
  params: z.object({ orgSlug: z.string().min(2) }),
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    role: z.enum(["ORG_SUPER_ADMIN", "ORG_ADMIN", "ORG_USER"]).optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
    search: z.string().trim().optional(),
  }),
});

// ─── Create user (invite) ─────────────────────────────────────────────────────

export const createOrgUserSchema = z.object({
  params: z.object({ orgSlug: z.string().min(2) }),
  body: z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    email: z.email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.enum(["ORG_ADMIN", "ORG_USER"]).default("ORG_USER"),
  }),
});

// ─── Update user ──────────────────────────────────────────────────────────────

export const updateOrgUserSchema = z.object({
  params: z.object({
    orgSlug: z.string().min(2),
    userId: z.string(),
  }),
  body: z
    .object({
      name: z.string().trim().min(2).optional(),
      profileImageUrl: z.url("Invalid URL").optional().or(z.literal("")),
      /**
       * Role can only be changed by ORG_SUPER_ADMIN.
       * The service layer enforces this — the schema just allows the field.
       */
      role: z.enum(["ORG_ADMIN", "ORG_USER"]).optional(),
    })
    .strict(), // reject unknown keys
});

// ─── Change own password ──────────────────────────────────────────────────────

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z
        .string()
        .min(8, "New password must be at least 8 characters"),
      confirmPassword: z.string(),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
});

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type ListOrgUsersQueryDTO = z.infer<typeof listOrgUsersSchema>["query"];
export type CreateOrgUserDTO = z.infer<typeof createOrgUserSchema>["body"];
export type UpdateOrgUserDTO = z.infer<typeof updateOrgUserSchema>["body"];
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>["body"];
