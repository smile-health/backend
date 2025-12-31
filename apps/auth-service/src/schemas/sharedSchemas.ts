import { z } from "@hono/zod-openapi";

// Error Response Schema
export const ErrorResponseSchema = z.object({
  code: z.number().openapi({
    description: "Error code",
    example: 500,
  }),
  message: z.union([
    z
      .string()
      .openapi({ description: "Error message", example: "Error message" }),
    z.array(z.any()).openapi({
      description: "Error messages or data",
      example: ["Error message 1", { error: "Error message 2" }],
    }),
  ]),
});

export const ActionByIdParamSchema = z.string().uuid().openapi({
  description: "User ID to take action",
  example: "cec29cd1-9ac2-4f1f-8b48-ed60b525c046",
});

export const AuthTokenSchema = z.string().jwt().openapi({
  description: "Bearer token for authorization",
  example: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
});

export const UserNameSchema = z.object({
  username: z
    .string()
    .min(3, "Username is required and must be at least 3 characters long")
    .openapi({
      description: "Username of the user",
      example: "testuser",
    }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
