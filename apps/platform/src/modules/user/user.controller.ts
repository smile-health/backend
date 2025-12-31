
import { Consumer, TOPIC } from "@smile/lib/rabbitmq"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { UserModule } from "./user.module.js"
import {
  DetailSchema,
  GetUserQueriesSchema,
  SyncUserSchema,
} from "./user.schema.js"
import { ExcelMiddleware } from "@smile/lib/middlewares"
import { DB } from "@/common/infrastructure/database/types/db.js"

export class UserController extends BaseController {
  constructor(
    private module: UserModule,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super()
  }

  registerWorkers(consumer: Consumer<DB>) {
    consumer.route(TOPIC.USER_CREATED, (c, msg) => {
      const jsonObject = JSON.parse(msg ?? "{}")
      this.module.syncData(c, SyncUserSchema.parse(jsonObject))
    })

    consumer.route(TOPIC.USER_UPDATED, (c, msg) => {
      const jsonObject = JSON.parse(msg ?? "{}")
      this.module.syncData(c, SyncUserSchema.parse(jsonObject))
    })
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/xls",
      this.validateRequest("query", GetUserQueriesSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.exportExcel(c, query)
        c.set("file", file)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", GetUserQueriesSchema),
      async (c) => {
        const query = c.req.valid("query")
        const result = await this.module.list(c, query)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", DetailSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const result = await this.module.detail(c, id)
        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
