import { IdParamsSchema } from "@smile/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { USER_ROLE } from "@/common/constants/user.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { EntityCustomerModule } from "./entity-customer.module.js"
import { EntityCustomerMiddleware } from "./entity-customer.middleware.js"
import {
  GetListEntityCustomerSchema,
  GetListEntityCustomerRelationSchema,
  GetExcelFileListEntityCustomerSchema,
  CreateEntityCustomerRequestSchema,
  UpdateEntityCustomerRequestSchema,
  ImportEntityCustomerRequestSchema,
  DeleteEntityCustomerRequestSchema,
} from "./entity-customer.schema.js"
import { ExcelMiddleware } from "@smile/lib/middlewares"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { EntityCustomerTemplate } from "./entity-customer.excel.js"

export class EntityCustomerController extends BaseController {
  constructor(
    private module: EntityCustomerModule,
    private entityCustomerMiddleware: EntityCustomerMiddleware,
    private excelMiddleware: ExcelMiddleware,
    private roleMiddleware: RoleMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.use(
      this.roleMiddleware.allow([USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN])
    )

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
      this.validateRequest("query", GetExcelFileListEntityCustomerSchema),
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
