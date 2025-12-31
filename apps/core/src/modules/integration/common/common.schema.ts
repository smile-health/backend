import { z } from "@hono/zod-openapi"

export const LoginRequestSchema = z.object({
  username: z.string(),
  password: z.string(),
})
