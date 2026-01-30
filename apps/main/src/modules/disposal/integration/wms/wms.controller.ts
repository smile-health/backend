import { DB } from "@/common/infrastructure/database/types/db.js"
import { type OpenAPIHono } from "@hono/zod-openapi"
import { TransactionMiddleware } from "@smile-health/lib/middlewares/transaction.middleware.js"
import { StatusCodes } from "http-status-codes"
import { DisposalInstructionService } from "../../disposal-instruction/disposal-instruction.service.js"
import { WmsMiddleware } from "./wms.middleware.js"
import { disposalCancellationRoute } from "./wms.routes.js"
import { RequestMiddleware } from "@smile-health/lib/middlewares/request.middleware.js"

export class WmsController {
  constructor(
    private readonly service: DisposalInstructionService,
    private readonly middleware: WmsMiddleware,
    private readonly trxMiddleware: TransactionMiddleware<DB>,
    private readonly reqMiddleware: RequestMiddleware,
  ) {}

  registerRoutes(app: OpenAPIHono) {
    const middlewares = [
      this.trxMiddleware.handle,
      this.reqMiddleware.handle,
      this.middleware.authorize,
      this.middleware.logRequest,
    ]

    app.use(disposalCancellationRoute.getRoutingPath(), ...middlewares)
    app.openapi(disposalCancellationRoute, async (c) => {
      const req = c.req.valid("json")
      await this.service.cancelInstruction(c, req)
      return c.body(null, StatusCodes.NO_CONTENT)
    })
  }
}
