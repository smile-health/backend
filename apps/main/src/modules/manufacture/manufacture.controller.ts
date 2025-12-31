import { BaseController } from "@smile/lib/base/controller.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { ManufactureModule } from "./manufacture.module.js"
import {
  ManufactureDetailRequestSchema,
  ManufacturePaginatedRequestSchema,
  UpdateStatusRequestSchema,
} from "./manufacture.schema.js"

export class ManufactureController extends BaseController {
  constructor(private readonly module: ManufactureModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", ManufacturePaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", ManufactureDetailRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, { id: param.id })

        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/status",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", UpdateStatusRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const request = c.req.valid("json")
        await this.module.updateStatus(c, param.id, request)
        return c.json({ status: true }, StatusCodes.OK)
      }
    )
    return router
  }
}
