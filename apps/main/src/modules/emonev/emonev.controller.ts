import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { EmonevModule } from "./emonev.module.js"
import {
  GetEmonevProvinceSchema,
  GetEmonevRegencySchema,
} from "./emonev.schema.js"

export class EmonevController extends BaseController {
  constructor(private readonly module: EmonevModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/province",
      this.validateRequest("query", GetEmonevProvinceSchema),
      async (c) => {
        const params = c.req.valid("query")
        const result = await this.module.getProvince(c, params)

        if (!result) {
          return c.json(
            {
              message: "Province not found",
            },
            StatusCodes.NOT_FOUND
          )
        }

        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/regency",
      this.validateRequest("query", GetEmonevRegencySchema),
      async (c) => {
        const params = c.req.valid("query")
        const result = await this.module.getRegency(c, params)

        if (!result) {
          return c.json(
            {
              message: "Regency not found",
            },
            StatusCodes.NOT_FOUND
          )
        }

        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
