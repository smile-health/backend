import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { EventReportReasonModule } from "./event-report-reason.module.js"

export class EventReportReasonController extends BaseController {
  constructor(private readonly module: EventReportReasonModule) {
    super("event-report-reason")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get("/reasons", async (c) => {
      const res = await this.module.list(c)
      return c.json(res, StatusCodes.OK)
    })

    return router
  }
}
