import { z } from "@hono/zod-openapi";

export const ForgotPasswordRequestSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .openapi({
      description: "Email address of the user requesting password reset",
      example: "user@example.com",
    }),
});

export const ForgotPasswordResponseSchema = z.object({
  message: z
    .string()
    .openapi({
      description: "Success message",
      example: "If an account with that email exists, a password reset link has been sent.",
    }),
});

export const ForgotPasswordErrorSchema = z.object({
  message: z.union([z.string(), z.array(z.any())]),
  code: z.number(),
});

export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
export type ForgotPasswordResponse = z.infer<typeof ForgotPasswordResponseSchema>;
