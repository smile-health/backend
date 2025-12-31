
import { Consumer, TOPIC } from "@smile/lib/rabbitmq"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { ManufactureModule } from "./manufacture.module.js"
import {
  ManufactureDetailRequestSchema,
  ManufacturePaginatedRequestSchema,
  ManufactureSyncSchema,
} from "./manufacture.schema.js"

export class ManufactureController extends BaseController {
  constructor(private readonly module: ManufactureModule) {
    super()
  }

  registerWorkers(consumer: Consumer<Database>) {
    consumer.route(TOPIC.MANUFACTURE_CREATED, (c, msg) => {
      const jsonObject = JSON.parse(msg ?? "{}")
      this.module.syncData(c, ManufactureSyncSchema.parse(jsonObject))
    })

    consumer.route(TOPIC.MANUFACTURE_UPDATED, (c, msg) => {
      const jsonObject = JSON.parse(msg ?? "{}")
      this.module.syncData(c, ManufactureSyncSchema.parse(jsonObject))
    })
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", ManufacturePaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const rsp = await this.module.list(c, query)
        return c.json(rsp, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", ManufactureDetailRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const rsp = await this.module.detail(c, param.id)
        return c.json(rsp, StatusCodes.OK)
      }
    )

    return router
  }
}
