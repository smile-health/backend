import { DB } from "@/common/infrastructure/database/types/db.js"
import { CommonMiddleware } from "@/common/middlewares/common.middleware.js"
import { OrderStatusCancelModule } from "@/modules/order-status/order-status-cancel/order-status-cancel.module.js"
import { OrderStatusConfirmModule } from "@/modules/order-status/order-status-confirm/order-status-confirm.module.js"
import { type OpenAPIHono } from "@hono/zod-openapi"
import { RequestMiddleware } from "@smile/lib/middlewares/request.middleware.js"
import { TransactionMiddleware } from "@smile/lib/middlewares/transaction.middleware.js"
import { StatusCodes } from "http-status-codes"
import { SihaContext } from "./siha.context.js"
import { SihaMiddleware } from "./siha.middleware.js"
import { SihaModule } from "./siha.module.js"
import {
  authLoginRoute,
  cancelOrderRoute,
  confirmOrderRoute,
  createOrderRoute,
  entitiesRoute,
  getOrderRoute,
  getOrderStatusRoute,
  getOrdersRoute,
  manufacturesRoute,
  materialsRoute,
  budgetSourcesRoute,
} from "./siha.routes.js"

export class SihaController {
  constructor(
    private readonly module: SihaModule,
    private readonly confirmModule: OrderStatusConfirmModule,
    private readonly cancelModule: OrderStatusCancelModule,
    private readonly middleware: SihaMiddleware,
    private readonly reqMiddleware: RequestMiddleware,
    private readonly trxMiddleware: TransactionMiddleware<DB>,
    private readonly commonMiddleware: CommonMiddleware
  ) {}
  registerRoutes(app: OpenAPIHono) {
    const middlewares = [
      this.reqMiddleware.handle,
      this.commonMiddleware.loadSlaveDB,
      this.trxMiddleware.handle,
      this.middleware.authorize,
      this.middleware.logRequest,
    ]

    app.use(authLoginRoute.getRoutingPath(), this.reqMiddleware.handle)
    app.openapi(authLoginRoute, async (c) => {
      const req = c.req.valid("json")
      const resp = await this.module.login(c, req)
      return c.json(resp, StatusCodes.OK)
    })

    app.use(
      createOrderRoute.getRoutingPath(),
      ...middlewares,
      this.middleware.prepareCreateRequest
    )
    app.openapi(createOrderRoute, async (c) => {
      const req = c.req.valid("json")
      const { createRequest } = (c as SihaContext).var
      const resp = await this.module.createOrder(c, req, createRequest)
      return c.json(resp, StatusCodes.OK)
    })

    app.use(
      confirmOrderRoute.getRoutingPath(),
      ...middlewares,
      this.middleware.validateOrder,
      this.middleware.prepareConfirmRequest
    )
    app.openapi(confirmOrderRoute, async (c) => {
      const { orderId, confirmRequest } = (c as SihaContext).var
      await this.confirmModule.update(c, orderId, confirmRequest)
      return c.body(null, StatusCodes.NO_CONTENT)
    })

    app.use(
      cancelOrderRoute.getRoutingPath(),
      ...middlewares,
      this.middleware.validateOrder,
      this.middleware.prepareCancelRequest
    )
    app.openapi(cancelOrderRoute, async (c) => {
      const { orderId, cancelRequest } = (c as SihaContext).var
      await this.cancelModule.update(c, orderId, cancelRequest)
      return c.body(null, StatusCodes.NO_CONTENT)
    })

    app.use(
      getOrderStatusRoute.getRoutingPath(),
      ...middlewares,
      this.middleware.validateOrder
    )
    app.openapi(getOrderStatusRoute, async (c) => {
      const { orderId } = (c as SihaContext).var
      const resp = await this.module.getDetail(c, orderId)
      return c.json(resp, StatusCodes.OK)
    })

    app.use(getOrderRoute.getRoutingPath(), ...middlewares)
    app.openapi(getOrderRoute, async (c) => {
      const { order_id } = c.req.valid("param")
      const resp = await this.module.getDetail(c, order_id)
      return c.json(resp, StatusCodes.OK)
    })

    app.use(getOrdersRoute.getRoutingPath(), ...middlewares)
    app.openapi(getOrdersRoute, async (c) => {
      const query = c.req.valid("query")
      const resp = await this.module.getOrdersList(c, query)
      return c.json(resp, StatusCodes.OK)
    })

    app.use(materialsRoute.getRoutingPath(), ...middlewares)
    app.openapi(materialsRoute, async (c) => {
      const params = c.req.valid("query")
      const resp = await this.module.getMaterials(c, params)
      return c.json(resp, StatusCodes.OK)
    })

    app.use(entitiesRoute.getRoutingPath(), ...middlewares)
    app.openapi(entitiesRoute, async (c) => {
      const params = c.req.valid("query")
      const resp = await this.module.getEntities(c, params)
      return c.json(resp, StatusCodes.OK)
    })

    app.use(manufacturesRoute.getRoutingPath(), ...middlewares)
    app.openapi(manufacturesRoute, async (c) => {
      const params = c.req.valid("query")
      const resp = await this.module.getManufactures(c, params)
      return c.json(resp, StatusCodes.OK)
    })

    app.use(budgetSourcesRoute.getRoutingPath(), ...middlewares)
    app.openapi(budgetSourcesRoute, async (c) => {
      const params = c.req.valid("query")
      const resp = await this.module.getBudgetSources(c, params)
      return c.json(resp, StatusCodes.OK)
    })
  }
}
