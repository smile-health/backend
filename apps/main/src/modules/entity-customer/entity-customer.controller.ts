import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { ExcelMiddleware } from "@smile/lib/middlewares"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { EntityCustomerTemplate } from "./entity-customer.excel.js"
import { EntityCustomerMiddleware } from "./entity-customer.middleware.js"
import { EntityCustomerModule } from "./entity-customer.module.js"
import {
  CreateEntityCustomerRequestSchema,
  DeleteEntityCustomerRequestSchema,
  GetListEntityCustomerRelationSchema,
  GetListEntityCustomerSchema,
  ImportEntityCustomerRequestSchema,
  UpdateEntityCustomerRequestSchema,
} from "./entity-customer.schema.js"

export class EntityCustomerController extends BaseController {
  constructor(
    private readonly module: EntityCustomerModule,
    private readonly entityCustomerMiddleware: EntityCustomerMiddleware,
    private readonly excelMiddleware: ExcelMiddleware,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.delete(
      "/customers",
      this.validateRequest("json", DeleteEntityCustomerRequestSchema),
      this.entityCustomerMiddleware.validateDeleteCustomer,
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.delete(c, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/customers",
      this.validateRequest("json", UpdateEntityCustomerRequestSchema),
      this.entityCustomerMiddleware.validateUpdateCustomer,
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.update(c, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/customers",
      this.validateRequest("json", CreateEntityCustomerRequestSchema),
      this.entityCustomerMiddleware.validateAddCustomer,
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.create(c, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id/customers/list-relation-customers",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("query", GetListEntityCustomerRelationSchema),
      async (c) => {
        const param = c.req.valid("param")
        const query = c.req.valid("query")
        const response = await this.module.listRelationCustomer(
          c,
          query,
          param.id
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id/customers/xls-template",
      this.validateRequest("param", IdParamsSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const param = c.req.valid("param")
        const file = await this.module.exportTemplate(c, param.id)
        c.set("file", file)
      }
    )

    router.get(
      "/:id/customers/xls",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("query", GetListEntityCustomerSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const param = c.req.valid("param")
        const query = c.req.valid("query")
        const file = await this.module.export(c, query, param.id)
        c.set("file", file)
      }
    )

    router.post(
      "/:id/customers/xls",
      this.excelMiddleware.validateFileMiddleware,
      this.validateRequest("param", IdParamsSchema),
      this.validateExcelRequest(
        ImportEntityCustomerRequestSchema,
        new EntityCustomerTemplate(),
        this.entityCustomerMiddleware.validateImportEntityCustomer
      ),
      async (c) => {
        const rows = c.req.valid("json")
        const param = c.req.valid("param")
        const response = await this.module.import(c, param.id, rows)

        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.get(
      "/:id/customers",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("query", GetListEntityCustomerSchema),
      async (c) => {
        const param = c.req.valid("param")
        const query = c.req.valid("query")
        const response = await this.module.list(c, query, param.id)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
