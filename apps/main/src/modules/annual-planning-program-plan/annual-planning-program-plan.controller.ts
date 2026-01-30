import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AnnualPlanningProgramPlanModule } from "./annual-planning-program-plan.module.js"
import {
  GetListProgramPlanSchema,
  SubmitProgramPlanSchema,
} from "./annual-planning-program-plan.schema.js"
import { AnnualPlanningProgramPlanMiddleware } from "./annual-planning-program-plan.middleware.js"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"

export class AnnualPlanningProgramPlanController extends BaseController {
  constructor(
    private readonly module: AnnualPlanningProgramPlanModule,
    private readonly middleware: AnnualPlanningProgramPlanMiddleware
  ) {
    super("annual_planning_program_plan")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/:id/complete-status",
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const response = await this.module.status(c, Number(id))
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const response = await this.module.detail(c, Number(id))
        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const response = await this.module.submitStatus(c, Number(id))
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", GetListProgramPlanSchema),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const response = await this.module.list(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/",
      this.validateRequest(
        "json",
        SubmitProgramPlanSchema,
        this.middleware.submit
      ),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.submit(c, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
