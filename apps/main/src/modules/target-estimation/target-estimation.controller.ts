import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { TargetEstimationModule } from "./target-estimation.module.js"
import {
  CalculateTargetEstimationPathRequestSchema,
  CalculateTargetEstimationRequestSchema,
  GetDetailCalculateSchema,
  GlobalCategoryRequestSchema,
  SchoolIdParamSchema,
  VillageIdParamSchema,
  DataCheckerQuerySchema,
} from "./target-estimation.schema.js"
import { TargetEstimationMiddleware } from "./target-estimation.middleware.js"

export class TargetEstimationController extends BaseController {
  constructor(
    private readonly middleware: TargetEstimationMiddleware,
    private readonly module: TargetEstimationModule
  ) {
    super()
  }

  readonly #getEntityId = (c: any) => Number(c.var.userEntity?.global_id)
  readonly #getSubDistrictId = (c: any) =>
    Number(c.var.userEntity?.sub_district_id || 0)

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const payload = c.req.valid("json")
        const result = await this.module.saveEstimation(
          c,
          payload,
          this.#getEntityId(c)
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.post(
      "/bias",
      this.validateRequest("json", this.middleware.createBias),
      async (c) => {
        const payload = c.req.valid("json")
        const result = await this.module.saveEstimationBias(
          c,
          payload,
          this.#getEntityId(c)
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.put(
      "/village/:village_id",
      this.validateRequest("param", VillageIdParamSchema),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const params = c.req.valid("param")
        const payload = c.req.valid("json")
        const result = await this.module.updateEstimation(
          c,
          params,
          payload,
          this.#getEntityId(c)
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.put(
      "/bias/school/:school_id",
      this.validateRequest("param", SchoolIdParamSchema),
      this.validateRequest("json", this.middleware.updateBias),
      async (c) => {
        const params = c.req.valid("param")
        const payload = c.req.valid("json")
        const result = await this.module.updateEstimationBias(
          c,
          params,
          payload,
          this.#getEntityId(c)
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/detail",
      this.validateRequest("query", GetDetailCalculateSchema),
      async (c) => {
        const query = c.req.valid("query")
        const result = await this.module.getTargetSummaryById(c, query)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/immunization-service",
      this.validateRequest("query", GlobalCategoryRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const result = await this.module.getImmunizationServiceDashboard(
          c,
          query,
          this.#getSubDistrictId(c),
          this.#getEntityId(c)
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get("/community-health-worker", async (c) => {
      const result = await this.module.getCommunityHealthWorkerSummary(
        c,
        this.#getSubDistrictId(c)
      )
      return c.json(result, StatusCodes.OK)
    })

    router.get(
      "/menu-checker",
      this.validateRequest("query", DataCheckerQuerySchema),
      async (c) => {
        const { category, keyword } = c.req.valid("query")
        const result = await this.module.getDataChecker(
          c,
          category,
          this.#getSubDistrictId(c),
          this.#getEntityId(c),
          keyword
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/injection-dashboard",
      this.validateRequest("query", GlobalCategoryRequestSchema),
      async (c) => {
        const { category } = c.req.valid("query")
        const result = await this.module.getInjectionDashboard(
          c,
          category,
          this.#getSubDistrictId(c)
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.post(
      "/:id",
      this.validateRequest("param", CalculateTargetEstimationPathRequestSchema),
      this.validateRequest("json", CalculateTargetEstimationRequestSchema),
      async (c) => {
        const params = c.req.valid("param")
        const payload = c.req.valid("json")
        const result = await this.module.calculateTargetEstimation(
          c,
          params,
          payload
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
