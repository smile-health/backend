import { RoleValidationMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { EntityTemplate } from "./entity.excel.js"
import { EntityMiddleware } from "./entity.middleware.js"
import { EntityModule } from "./entity.module.js"
import { GetEntitiesParamsSchema } from "./entity.schema.js"

export class EntityController extends BaseController {
  constructor(
    private readonly module: EntityModule,
    private readonly entityMiddleware: EntityMiddleware,
    private readonly excelMiddleware: ExcelMiddleware,
    private readonly roleValidationMiddleware: RoleValidationMiddleware
  ) {
    super("entity")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetEntitiesParamsSchema),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const page = await this.module.list(c, paramQuery)
        return c.json(page, StatusCodes.OK)
      }
    )

    router.post(
      "/",
      this.validateRequest("json", this.entityMiddleware.create),
      this.entityMiddleware.sanitizeEntityData(),
      async (c) => {
        const data = c.req.valid("json")
        const entity = await this.module.saveEntity(c, data)
        return c.json(entity, StatusCodes.OK)
      }
    )

    router.post(
      "/xls",
      this.excelMiddleware.validateFileMiddleware,
      this.validateExcelRequest(
        this.entityMiddleware.import,
        new EntityTemplate()
      ),
      async (c) => {
        const rows = c.req.valid("json")
        const response = await this.module.import(c, rows)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.get(
      "/xls",
      this.validateRequest("query", this.entityMiddleware.list),
      async (c) => {
        const paramQuery = c.req.valid("query")

        const response = await this.module.getExportedData(c, paramQuery)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/xls-template",
      this.excelMiddleware.handleExport,
      async (c) => {
        const template = await this.module.getTemplate(c)
        c.set("file", template)
      }
    )

    router.get("/:id", this.entityMiddleware.entityIdValidation, async (c) => {
      const param = c.req.valid("param")
      const entities = await this.module.getDetail(c, Number(param.id))

      return c.json(entities, StatusCodes.OK)
    })

    router.put(
      "/:id",
      this.entityMiddleware.entityIdValidation,
      this.validateRequest(
        "json",
        this.entityMiddleware.create,
        this.entityMiddleware.checkEntityRelation
      ),
      this.entityMiddleware.sanitizeEntityData(),
      async (c) => {
        const param = c.req.valid("param")
        const data = c.req.valid("json")

        const entity = await this.module.updateEntity(c, data, Number(param.id))
        return c.json(entity, StatusCodes.OK)
      }
    )

    return router
  }
}
