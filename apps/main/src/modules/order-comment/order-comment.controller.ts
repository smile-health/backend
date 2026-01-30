import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { OrderCommentMiddleware } from "./order-comment.middleware.js"
import { OrderCommentModule } from "./order-comment.module.js"
import { GetDetailOrderSchema } from "./order-comment.schema.js"

export class OrderCommentController extends BaseController {
  constructor(
    private readonly middleware: OrderCommentMiddleware,
    private readonly module: OrderCommentModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("order_comment")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/:id/comments",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
        [USER_ROLE.MANUFACTURE, DEVICE_TYPE.web],
      ]),
      this.validateRequest("param", GetDetailOrderSchema),
      this.middleware.detailOrder,
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await this.module.create(c, param.id, body)
        return c.json(undefined, StatusCodes.NO_CONTENT)
      }
    )

    return router
  }
}
