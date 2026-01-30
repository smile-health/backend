import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { EntityMaterialMiddleware } from "./entity-material.middleware.js"
import { EntityMaterialModule } from "./entity-material.module.js"
import {
  DeleteSchema,
  DetailSchema,
  GetEntityMaterialQueriesSchema,
} from "./entity-material.schema.js"

export class EntityMaterialController extends BaseController {
  constructor(
    private readonly module: EntityMaterialModule,
    private readonly middleware: EntityMaterialMiddleware,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("entity_material")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/:entityId/materials",
      this.validateRequest("param", DetailSchema),
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const body = c.req.valid("json")
        const res = await this.module.create(c, body)
        return c.json(res, StatusCodes.CREATED)
      }
    )

    router.get(
      "/:entityId/materials",
      this.validateRequest("param", this.middleware.list),
      this.validateRequest("query", GetEntityMaterialQueriesSchema),
      async (c) => {
        const param = c.req.valid("param")
        const query = c.req.valid("query")
        const res = await this.module.list(c, query, param)
        if (res.data.length === 0) {
          return c.body(null, StatusCodes.NO_CONTENT)
        }
        return c.json(res, StatusCodes.OK)
      }
    )

    router.delete(
      "/:entityId/materials/:entityMasterMaterialActivityId",
      this.validateRequest("param", DeleteSchema),
      this.middleware.delete,
      async (c) => {
        const param = c.req.valid("param")
        await this.module.delete(c, param)
        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    router.put(
      "/:entityId/materials",
      this.validateRequest("param", DetailSchema),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const body = c.req.valid("json")
        const res = await this.module.update(c, body)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
