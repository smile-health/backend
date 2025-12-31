import { USER_ROLE } from "@/common/constants/user.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { ExcelMiddleware } from "@smile/lib/middlewares"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { GlobalEntityDto } from "@smile/lib/types/global.schema.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import env from "@/config/env.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { EntityModule } from "./entity.module.js"
import {
  GetListEntitySchema,
  UpdateStatusEntityRequestSchema,
} from "./entity.schema.js"

export class EntityController extends BaseController {
  constructor(
    private module: EntityModule,
    private excelMiddleware: ExcelMiddleware,
    private roleMiddleware: RoleMiddleware
  ) {
    super()
  }

  #isCorrectProgramId = (jsonObject): boolean => {
    const { program_ids } = jsonObject
    const programIds = program_ids ?? []
    return programIds.includes(env.WORKSPACE_ID)
  }

  public registerWorkers(consumer: Consumer<DB>): void {
    consumer.route(TOPIC.ENTITY_CREATED, (c, msg) => {
      const jsonObject = JSON.parse(msg ?? "{}")
      if (this.#isCorrectProgramId(jsonObject))
        this.module.syncGlobalEntity(c, GlobalEntityDto.parse(jsonObject))
    })

    consumer.route(TOPIC.ENTITY_UPDATED, (c, msg) => {
      const jsonObject = JSON.parse(msg ?? "{}")
      if (this.#isCorrectProgramId(jsonObject))
        this.module.syncGlobalEntity(c, GlobalEntityDto.parse(jsonObject))
    })
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.use(
      this.roleMiddleware.allow([USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN])
    )

    router.get(
      "/xls",
      this.excelMiddleware.handleExport,
      this.validateRequest("query", GetListEntitySchema),
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.export(c, query)
        c.set("file", file)
      }
    )

    router.put(
      "/:id/status",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", UpdateStatusEntityRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const reqBody = c.req.valid("json")
        const response = await this.module.updateStatus(c, param.id, reqBody)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/status/vendors",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", UpdateStatusEntityRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const reqBody = c.req.valid("json")
        const response = await this.module.updateStatusVendor(
          c,
          param.id,
          reqBody
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, param.id)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", GetListEntitySchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
