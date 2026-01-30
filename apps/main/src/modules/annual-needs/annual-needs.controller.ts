import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AnnualNeedModule } from "./annual-needs.module.js"
import {
  AnnualNeedIdParamsSchema,
  AnnualNeedIdParamsSchemaWithId,
  AnnualNeedIpvSchema,
  AnnualNeedPopulationSchema,
  CreateAnnualNeedsSchema,
  EntityIdParamsSchema,
  GetAnnualNeedResultSchema,
  GetListAnnualNeedsByEntitySchema,
  GetListAnnualNeedsSchema,
  GetMonthlyDistributionQueriesSchema,
  GetNationalIpQueriesSchema,
  GetPopulationQueriesSchema,
  ProgramPlanIdParamsSchema,
  UpdateAnnualNeedStatusSchema,
  UpdatePopulationStatusSchema,
  GetAnnualNeedIpQueriesSchema,
  UpdateIpStatusSchema,
  UpdatePopulationSchema,
  UpdateIpSchema,
  CreateAnnualNeedResultSchema,
  ActivatedMinMaxRegencySchema,
  ActivatedMinMaxProvinceSchema,
} from "./annual-needs.schema.js"
import { AnnualNeedMiddleware } from "./annual-needs.middleware.js"

export class AnnualNeedController extends BaseController {
  constructor(
    private readonly module: AnnualNeedModule,
    private readonly middleware: AnnualNeedMiddleware
  ) {
    super("ws_annual_needs")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/",
      this.validateRequest(
        "json",
        CreateAnnualNeedsSchema,
        this.middleware.submit
      ),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.submit(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", GetListAnnualNeedsSchema),
      async (c) => {
        const params = c.req.valid("query")
        const response = await this.module.listNeedsProvince(c, params)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:annualNeedId",
      this.validateRequest("param", AnnualNeedIdParamsSchema),
      this.validateRequest("json", UpdateAnnualNeedStatusSchema),
      async (c) => {
        const { annualNeedId } = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.updateStatus(c, annualNeedId, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", AnnualNeedIdParamsSchemaWithId),
      async (c) => {
        const { id } = c.req.valid("param")
        const response = await this.module.getById(c, id)

        if (!response) {
          return c.json({ message: "Data not found" }, StatusCodes.NOT_FOUND)
        }

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id/population",
      this.validateRequest("param", AnnualNeedIdParamsSchemaWithId),
      async (c) => {
        const { id } = c.req.valid("param")
        const response = await this.module.getPopulationByAnnualNeedId(c, id)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/population-status",
      this.validateRequest("param", AnnualNeedIdParamsSchemaWithId),
      this.validateRequest("json", UpdatePopulationStatusSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.updatePopulationStatus(c, id, body)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/ip-status",
      this.validateRequest("param", AnnualNeedIdParamsSchemaWithId),
      this.validateRequest("json", UpdateIpStatusSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.updateIpStatus(c, id, body)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/ip",
      this.validateRequest("param", AnnualNeedIdParamsSchemaWithId),
      this.validateRequest("json", UpdateIpSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.updateIp(c, id, body)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/population",
      this.validateRequest("param", AnnualNeedIdParamsSchemaWithId),
      this.validateRequest("json", UpdatePopulationSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.updatePopulation(c, id, body)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/population",
      this.validateRequest("json", AnnualNeedPopulationSchema),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.submitAnnualNeedPopulation(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.post(
      "/ip",
      this.validateRequest("json", AnnualNeedIpvSchema),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.submitAnnualNeedIpv(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.get(
      "/:programPlanId/national-ip",
      this.validateRequest("param", ProgramPlanIdParamsSchema),
      this.validateRequest("query", GetNationalIpQueriesSchema),
      async (c) => {
        const { programPlanId } = c.req.valid("param")
        const params = c.req.valid("query")
        const response = await this.module.getNationalIp(
          c,
          programPlanId,
          params
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:annualNeedId/result/monthly-distribution",
      this.validateRequest("param", AnnualNeedIdParamsSchema),
      this.validateRequest("query", GetMonthlyDistributionQueriesSchema),
      async (c) => {
        const { annualNeedId } = c.req.valid("param")
        const { entity_id, material_id, activity_id } = c.req.valid("query")
        const response = await this.module.getMonthlyDistributionDetail(
          c,
          annualNeedId,
          entity_id,
          material_id,
          activity_id
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:programPlanId/annual-needs/population",
      this.validateRequest("param", ProgramPlanIdParamsSchema),
      this.validateRequest("query", GetPopulationQueriesSchema),
      async (c) => {
        const { programPlanId } = c.req.valid("param")
        const params = c.req.valid("query")
        const response = await this.module.getPopulation(
          c,
          programPlanId,
          params
        )

        if (!response) {
          return c.json({ message: "Data not found" }, StatusCodes.NOT_FOUND)
        }

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:annualNeedId/result",
      this.validateRequest("param", AnnualNeedIdParamsSchema),
      this.validateRequest("query", GetAnnualNeedResultSchema),
      async (c) => {
        const { annualNeedId } = c.req.valid("param")
        const params = c.req.valid("query")
        const response = await this.module.getAnnualNeedResultList(
          c,
          annualNeedId,
          params
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:annualNeedId/ip",
      this.validateRequest("param", AnnualNeedIdParamsSchema),
      this.validateRequest("query", GetAnnualNeedIpQueriesSchema),
      async (c) => {
        const { annualNeedId } = c.req.valid("param")
        const params = c.req.valid("query")
        const response = await this.module.getAnnualNeedIp(
          c,
          annualNeedId,
          params
        )
        if (!response) {
          return c.json({ message: "Annual need not found" }, StatusCodes.NOT_FOUND)
        }
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }

  getEntityRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/entity/:entityId/annual-needs",
      this.validateRequest("param", EntityIdParamsSchema),
      this.validateRequest("query", GetListAnnualNeedsByEntitySchema),
      async (c) => {
        const { entityId } = c.req.valid("param")
        const params = c.req.valid("query")
        const response = await this.module.listNeedsByEntity(
          c,
          entityId,
          params
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/annual-needs/result",
      this.validateRequest("json", CreateAnnualNeedResultSchema),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.createAnnualNeedResult(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.post(
      "/annual-needs/activate-min-max/regency",
      this.validateRequest("json", ActivatedMinMaxRegencySchema),
      async (c) => {
        const body = c.req.valid("json")
        const { program_plan_id, annual_need_ids} = body;
        const response = await this.module.activatedMinMaxRegency(c, program_plan_id, annual_need_ids)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/annual-needs/activate-min-max/province",
      this.validateRequest("json", ActivatedMinMaxProvinceSchema),
      async (c) => {
        const body = c.req.valid("json")
        const { program_plan_id, province_id} = body
        const response = await this.module.activatedMinMaxProvince(c, program_plan_id, province_id)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
