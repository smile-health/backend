import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { TaskMiddleware } from "./task.middleware.js"
import { TaskModule } from "./task.module.js"
import {
  CoverageParams,
  CoverageQueries,
  ListQueries,
  ProgramPlanParams,
  UpdateInput,
  coverageParamsSchema,
  coverageQueriesSchema,
  detailParamsSchema,
  listQueriesSchema,
  programPlanParamsSchema,
} from "./task.schema.js"

export class TaskController extends BaseController {
  constructor(
    private readonly module: TaskModule,
    private readonly middleware: TaskMiddleware
  ) {
    super("plan_tasks")
  }

  getRoutes() {
    const router = new Hono()

    router.get(
      "/:id/task",
      this.validateRequest("param", programPlanParamsSchema),
      this.validateRequest("query", listQueriesSchema),
      async (c) => {
        const params = c.req.valid("param") as ProgramPlanParams
        const queries = c.req.valid("query") as ListQueries
        const result = await this.module.list(c, params.id, queries)

        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/task/:id",
      this.validateRequest("param", detailParamsSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const result = await this.module.getById(c, id)

        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/task/:id/coverage",
      this.validateRequest("param", coverageParamsSchema),
      this.validateRequest("query", coverageQueriesSchema),
      async (c) => {
        const params = c.req.valid("param") as CoverageParams
        const queries = c.req.valid("query") as CoverageQueries
        const result = await this.module.getCoverage(c, params.id, queries)

        return c.json(result, StatusCodes.OK)
      }
    )

    router.post(
      "/task",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const body = c.req.valid("json")
        await this.module.create(c, body)

        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    router.put(
      "/task/:id",
      this.validateRequest("param", detailParamsSchema),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const { id } = c.req.valid("param")
        const body = c.req.valid("json") as UpdateInput
        await this.module.update(c, id, body)

        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    router.delete(
      "/task/:id",
      this.validateRequest("param", detailParamsSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        await this.module.delete(c, id)

        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    return router
  }
}
