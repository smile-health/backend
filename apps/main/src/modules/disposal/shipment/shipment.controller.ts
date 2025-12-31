/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from "hono"
import { BaseController } from "@smile/lib/base/controller.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { ExcelMiddleware } from "@smile/lib/middlewares/excel.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { DisposalShipmentModule } from "./shipment.module.js";
import { DisposalShipmentMiddleware } from "./shipment.middleware.js";
import { DEVICE_TYPE } from "@/common/constants/device.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"

import {
  GetListShipmentSchema,
  GetStatusCountSchema,
  CreateShipmentRequestSchema,
  CommentShipmentRequestSchema,
  AcceptShipmentRequestSchema,
  CancelShipmentRequestSchema
} from "./shipment.schema.js"

export class DisposalShipmentController extends BaseController {

  constructor(
    private readonly module: DisposalShipmentModule,
    private readonly middleware: DisposalShipmentMiddleware,
    private readonly roleMiddleware: RoleMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("disposal-shipment")
  }

  getRoutes(): Hono {
    const router = new Hono()

    // router.use(
    //   this.roleMiddleware.allowWithDeviceType([
    //     [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
    //     [USER_ROLE.ADMIN, DEVICE_TYPE.web],
    //     [USER_ROLE.MANAGER, DEVICE_TYPE.web],
    //     [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
    //     [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
    //   ])
    // )

    router.get(
      "/xls",
      this.validateRequest("query", GetListShipmentSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const paramQuery = c.req.valid("query")
        const file = await this.module.export(c, paramQuery)
        c.set("file", file)
      }
    )    

    router.get(
      "/",
      this.validateRequest("query", GetListShipmentSchema),
      async (c: Context) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )    

    router.post(
      "/",
      this.validateRequest("json", CreateShipmentRequestSchema),
      async (c: Context) => {
        const body = c.req.valid("json")
        const response = await this.module.create(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.get(
      "/counts",
      this.validateRequest("query", GetStatusCountSchema),
      async (c: Context) => {
        const query = c.req.valid("query")
        const response = await this.module.count(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      async (c: Context) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, param.id)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/:id/comment",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", CommentShipmentRequestSchema),
      async (c: Context) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.comment(c, param.id, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.put(
      "/:id/accept",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", AcceptShipmentRequestSchema),
      async (c: Context) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.accept(c, param.id, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/cancel",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", CancelShipmentRequestSchema),
      async (c: Context) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await this.module.cancel(c, param.id, body)
        return c.json(undefined, StatusCodes.CREATED)
      }
    )
    
    router.get(
      "/:id/download",
      this.validateRequest("param", IdParamsSchema),
      this.excelMiddleware.handleExport,
      async (c: Context) => {
        const param = c.req.valid("param")
        const file = await this.module.downloadMemorandum(c, param.id)
        c.set("file", file)
      }
    )

    return router;
  }


}

