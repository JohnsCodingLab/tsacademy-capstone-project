import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be greater that two characters"),
    email: z.email("invalid email address").trim(),
    password: z.string().min(8),
    role: z.enum(["ADMIN", "MANAGER", "STAFF"]).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.email("invalid email address").trim(),
    password: z.string().min(8),
  }),
});

export type RegisterUserDTO = z.infer<typeof registerSchema>["body"];
export type LoginUserDTO = z.infer<typeof loginSchema>["body"];
