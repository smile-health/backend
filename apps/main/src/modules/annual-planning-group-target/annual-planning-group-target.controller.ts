import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AnnualPlanningGroupTargetModule } from "./annual-planning-group-target.module.js"
import {
  DeleteGroupTargetParamsSchema,
  SubmitGroupTargetSchema,
  GetListGroupTargetSchema,
} from "./annual-planning-group-target.schema.js"
import { AnnualPlanningGroupTargetMiddleware } from "./annual-planning-group-target.middleware.js"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"

export class AnnualPlanningGroupTargetController extends BaseController {
  constructor(
    private readonly module: AnnualPlanningGroupTargetModule,
    private readonly middleware: AnnualPlanningGroupTargetMiddleware
  ) {
    super("annual_planning_program_plan")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/program/:id/year/:year",
      this.validateRequest("query", GetListGroupTargetSchema),
      async (c) => {
        const param = c.req.valid("query")
        const response = await this.module.listGroupTarget(c, param)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.delete(
      "/:id/group-targets/:group_id",
      this.validateRequest(
        "param",
        DeleteGroupTargetParamsSchema,
        this.middleware.deleteProgramPlanGroupTarget
      ),
      async (c) => {
        const { id, group_id } = c.req.valid("param")
        const response = await this.module.delete(
          c,
          Number(id),
          Number(group_id)
        )

        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/:id/group-targets",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest(
        "json",
        SubmitGroupTargetSchema,
        this.middleware.submitProgramPlanGroupTarget
      ),
      async (c) => {
        const body = c.req.valid("json")
        const { id } = c.req.valid("param")
        const response = await this.module.submit(c, id, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id/group-targets",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("query", GetListGroupTargetSchema),
      async (c) => {
        const query = c.req.valid("query")
        const { id } = c.req.valid("param")
        const response = await this.module.list(c, Number(id), query)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
