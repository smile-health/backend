import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { NotificationModule } from "./notification.module.js"
import { NotificationMiddleware } from "./notification.middleware.js"
import { GetNotificationsTypesPaginationSchema } from "./notification.schema.js"
import { sendingRecapNotif } from "./notification.recap-module.js"
export class NotificationController extends BaseController {
  constructor(
    private readonly module: NotificationModule,
    private readonly middleware: NotificationMiddleware
  ) {
    super("notification")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", this.middleware.list),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const response = await this.module.list(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get("/count", async (c) => {
      const response = await this.module.count(c)
      return c.json(response, StatusCodes.OK)
    })

    router.get(
      "/types",
      this.validateRequest("query", GetNotificationsTypesPaginationSchema),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const response = await this.module.typeList(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.put("/read", async (c) => {
      await this.module.updateAllRead(c)
      return c.json(undefined, StatusCodes.NO_CONTENT)
    })

    router.put(
      "/:id/read",
      this.validateRequest("param", this.middleware.updateSingleRead),
      async (c) => {
        const param = c.req.valid("param")
        await this.module.updateSingleRead(Number(param.id))
        return c.json(undefined, StatusCodes.NO_CONTENT)
      }
    )

    router.get("/send-recap-email", async (c) => {
      const response = await sendingRecapNotif()
      return c.json(response, StatusCodes.OK)
    })

    return router
  }
}
