import { z } from "zod";

export const systemRegisterSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(8),
  }),
});

export const systemLoginSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(8),
  }),
});

export type RegisterSystemUserDTO = z.infer<
  typeof systemRegisterSchema
>["body"];
export type LoginSystemUserDTO = z.infer<typeof systemLoginSchema>["body"];
