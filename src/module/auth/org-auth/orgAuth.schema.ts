import z from "zod";

export const registerOrgSchema = z.object({
  body: z.object({
    organizationName: z.string().min(3),
    name: z.string().min(2),
    email: z.email(),
    password: z.string().min(8),
  }),
});

export const loginOrgSchema = z.object({
  body: z.object({
    orgSlug: z.string().min(2),
    email: z.email("invalid email address").trim(),
    password: z.string().min(8),
  }),
});

export type RegisterOrgUserDTO = z.infer<typeof registerOrgSchema>["body"];

export type LoginOrgUserDTO = z.infer<typeof loginOrgSchema>["body"];
