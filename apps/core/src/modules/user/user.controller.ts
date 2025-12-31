import { RoleValidationMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { ExcelMiddleware } from "@smile/lib/middlewares"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { UsersMiddleware } from "./user.middleware.js"
import { UserModule } from "./user.module.js"
import {
  profile,
  UpdateLastLoginSchema,
  UpdateStatusSchema,
  UserQueriesSchema,
  ValidateUserExistsSchema,
} from "./user.schema.js"

export class UserController extends BaseController {
  constructor(
    private readonly module: UserModule,
    private readonly userMiddleware: UsersMiddleware,
    private readonly roleValidationMiddleware: RoleValidationMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("user")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/xls",
      this.validateRequest("query", UserQueriesSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.exportExcel(c, query)
        c.set("file", file)
      }
    )

    router.get(
      "/xls-template",
      this.excelMiddleware.handleExport,
      async (c) => {
        const template = await this.module.templateExcel(c)
        c.set("file", template)
      }
    )

    router.post(
      "/xls",
      this.excelMiddleware.validateFileMiddleware,
      this.userMiddleware.parseExcelData,
      // this.validateExcelRequest(
      //   ImportUserRowsSchema,
      //   new UserTemplateXlsx(PROCESSOR.SHEETJS),
      //   this.userMiddleware.importUsersExcel
      // ), // need continue in middleware
      async (c) => {
        const body = c.req.valid("json")
        const result = await this.module.importExcel(c, body)
        if (!result.success) {
          return c.json(result, StatusCodes.CONFLICT)
        }
        return c.json(
          {
            status: true,
            message: `Data successfully created ${result.data} rows`,
          },
          StatusCodes.OK
        )
      }
    )

    router.get(
      "/",
      this.validateRequest("query", UserQueriesSchema),
      async (c) => {
        const q = c.req.valid("query")
        const result = await this.module.getList(c, q)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.post(
      "/",
      this.validateRequest("json", this.userMiddleware.create),
      async (c) => {
        const data = c.req.valid("json")
        data.created_by = c.var.accountID
        const rsp = await this.module.createUser(c, data)
        if (!rsp?.success) {
          return c.json(rsp, StatusCodes.CONFLICT)
        }
        return c.json(rsp.data, StatusCodes.CREATED)
      }
    )

    router.get("/:id", this.validateRequest("param", profile), async (c) => {
      const params = c.req.valid("param")
      const rsp = await this.module.detail(c, params)
      return c.json(rsp)
    })

    router.put(
      "/:id",
      this.validateRequest("param", profile),
      this.validateRequest("json", this.userMiddleware.update),
      async (c) => {
        const { id } = c.req.valid("param")
        const data = c.req.valid("json")
        data.updated_by = c.var.accountID
        const rsp = await this.module.update(c, data, Number(id))
        return c.json(rsp)
      }
    )

    router.get(
      "/:id/chg_history",
      this.validateRequest("param", profile),
      async (c) => {
        const { id } = c.req.valid("param")
        const result = await this.module.getChangeLogs(c, id)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/status",
      this.validateRequest("param", profile),
      this.validateRequest("json", UpdateStatusSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const data = c.req.valid("json")
        const result = await this.module.updateStatus(c, id, data)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.post(
      "/update-last-login",
      this.roleValidationMiddleware.validateDeviceRole,
      this.validateRequest("json", UpdateLastLoginSchema),
      async (c) => {
        const data = c.req.valid("json")
        await this.module.updateUserLastAndFcmByUUID(
          c,
          data,
          c.var.user.keycloak_uuid ?? c.var.user.user_uuid ?? ""
        )
        return c.json({ success: true }, StatusCodes.OK)
      }
    )

    router.post(
      "/validate-exists",
      this.validateRequest("json", ValidateUserExistsSchema),
      async (c) => {
        const { username } = c.req.valid("json")
        const result = await this.module.validateUserExists(c, username)
        return c.json({
          code: StatusCodes.OK,
          success: true,
          data: result,
        })
      }
    )

    return router
  }
}
