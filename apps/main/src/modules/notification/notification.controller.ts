import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { NotificationModule } from "./notification.module.js"
import {
  StockBackToNormalRequest,
  StopNotificationReasonPaginatedRequestSchema,
  StopNotificationRequest,
  TriggerPatientReminderNotificationSchema,
} from "./notification.schema.js"

export class NotificationController extends BaseController {
  constructor(private readonly module: NotificationModule) {
    super()
  }

  public getPublicRoutes(): Hono {
    const app = new Hono()

    app.post(
      "/stock-back-to-normal",
      this.validateRequest("json", StockBackToNormalRequest),
      async (c) => {
        const data = c.req.valid("json")
        const result = await this.module.processStockBackToNormal(c, data)

        return c.json(
          {
            message: result
              ? "Stock level has returned to normal"
              : "Stock level remains below normal or is already at normal level",
          },
          StatusCodes.OK
        )
      }
    )

    return app
  }

  public getAuthenticatedRoutes(): Hono {
    const app = new Hono()

    app.get(
      "/stop-reason",
      this.validateRequest(
        "query",
        StopNotificationReasonPaginatedRequestSchema
      ),
      async (c) => {
        const params = c.req.valid("query")
        const reasons = await this.module.getStopNotificationReasons(c, params)

        return c.json(reasons, StatusCodes.OK)
      }
    )

    app.put(
      "/stop",
      this.validateRequest("json", StopNotificationRequest),
      async (c) => {
        const data = c.req.valid("json")
        await this.module.stopNotification(c, data)
        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    app.get(
      "/send-patient-reminder-notif",
      this.validateRequest("query", TriggerPatientReminderNotificationSchema),
      async (c) => {
        try {
          const query = c.req.valid("query")
          const response = await this.module.triggerPatientReminderNotification(
            c,
            query
          )
          return c.json(response, StatusCodes.OK)
        } catch (error) {
          return c.json(
            {
              error: "Failed to send patient reminder notification",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            StatusCodes.INTERNAL_SERVER_ERROR
          )
        }
      }
    )

    return app
  }

  public getRoutes(): Hono {
    const app = new Hono()
    app.route("/", this.getPublicRoutes())
    app.route("/", this.getAuthenticatedRoutes())
    return app
  }
}
