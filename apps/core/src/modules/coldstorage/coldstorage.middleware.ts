import { BaseMiddleware } from "@smile-health/lib/base/middleware"
import { Context } from "hono"
import { AddColdStorageRequestSchema } from "./coldstorage.shcema"

export class ColdStorageMiddleware extends BaseMiddleware {
  constructor() {
    super()
  }

  create = (c: Context) => {
    return AddColdStorageRequestSchema.superRefine((data, ctx) => {})
  }
}
