// deduplication-middleware.ts
import { env } from "process"
import { hasher } from "node-object-hash"
import { createMiddleware } from "hono/factory"
import { redis } from "@/common/infrastructure/redis"
import { BadRequestError } from "@smile-health/lib/error.js"

export class DeduplicationMiddleware {
  private windowSeconds: number
  private methods = ["POST", "PUT", "PATCH"]
  private obj: ReturnType<typeof hasher>

  constructor() {
    // Ambil dari ENV atau default 15s
    this.windowSeconds = Number(env.REDIS_DEDUP_WINDOW_SECONDS ?? 5)
    this.obj = hasher({ sort: true, coerce: true })
  }

  get middleware() {
    return createMiddleware(async (c, next) => {
      if (!this.methods.includes(c.req.method)) {
        return await next()
      }

      const userId = Number(c.var.userId)

      if (!userId) {
        return c.json({ message: c.var.t("auth.unauthorized") }, 401)
      }

      const body = await c.req.json()
      const payloadHash = this.obj.hash(body)

      const dedupeKey = `dedupe:${c.req.path}:${userId}:${payloadHash}`

      const result = await redis.set(
        dedupeKey,
        "1",
        "EX",
        this.windowSeconds,
        "NX"
      )

      if (!result) {
        throw new BadRequestError(c.var.t("validator.duplicate_request"))
      }

      try {
        await next()
      } catch (error) {
        await redis.del(dedupeKey)
        throw error
      }
    })
  }
}
