import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { ImmunizationLogisticsModule } from "./immunization-logistics.module.js"
import { GlobalIdRequestSchema } from "./immunization-logistics.schema.js"

export class ImmunizationLogisticsController extends BaseController {
  constructor(private readonly module: ImmunizationLogisticsModule) {
    super("")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get("/routine-immunization", async (c) => {
      const subDistrictId = Number(c.var.userEntity?.sub_district_id || 0)
      const entityId = Number(c.var.userEntity?.global_id || 0)
      const result = await this.module.getNumberOfRoutineImmunization(
        c,
        subDistrictId,
        entityId
      )
      return c.json(result, StatusCodes.OK)
    })

    router.get("/vaccine-vials", async (c) => {
      const subDistrictId = Number(c.var.userEntity?.sub_district_id || 0)
      const entityId = Number(c.var.userEntity?.global_id || 0)
      const category = c.req.query("category") as
        | "bias"
        | "non-bias"
        | undefined

      if (category === "bias") {
        const result = await this.module.getVaccineVialsUsedBySchool(
          c,
          subDistrictId,
          entityId
        )
        return c.json(result, StatusCodes.OK)
      }

      const result = await this.module.getNumberVaccineVialsUsed(
        c,
        subDistrictId,
        entityId
      )
      return c.json(result, StatusCodes.OK)
    })

    router.get("/vaccine-utilization-rate", async (c) => {
      const subDistrictId = Number(c.var.userEntity?.sub_district_id || 0)
      const entityId = Number(c.var.userEntity?.global_id || 0)
      const category = c.req.query("category") as
        | "bias"
        | "non-bias"
        | undefined
      const result = await this.module.getVaccineUtilizationRate(
        c,
        subDistrictId,
        entityId,
        category
      )
      return c.json(result, StatusCodes.OK)
    })

    router.get("/projected-vaccine", async (c) => {
      const subDistrictId = Number(c.var.userEntity?.sub_district_id || 0)
      const entityId = Number(c.var.userEntity?.global_id || 0)
      const result = await this.module.getNumberOfProjectedOneYearVaccine(
        c,
        subDistrictId,
        entityId
      )
      return c.json(result, StatusCodes.OK)
    })

    router.get("/projected-monthly-vaccine", async (c) => {
      const subDistrictId = Number(c.var.userEntity?.sub_district_id || 0)
      const entityId = Number(c.var.userEntity?.global_id || 0)
      const result = await this.module.getNumberOfProjectedMonthlyVaccine(
        c,
        subDistrictId,
        entityId
      )
      return c.json(result, StatusCodes.OK)
    })

    router.get(
      "/projected-monthly-vaccine/:id",
      this.validateRequest("param", GlobalIdRequestSchema),
      async (c) => {
        const params = c.req.valid("param")
        const entityId = Number(c.var.userEntity?.global_id || 0)
        const result = await this.module.getDetailMonthlyVaccine(
          c,
          params.id,
          entityId
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get("/projected-monthly-immunization", async (c) => {
      const subDistrictId = Number(c.var.userEntity?.sub_district_id || 0)
      const entityId = Number(c.var.userEntity?.global_id || 0)
      const result = await this.module.getMonthlyImmunizationLogisticsNeed(
        c,
        subDistrictId,
        entityId
      )
      return c.json(result, StatusCodes.OK)
    })

    router.get(
      "/projected-monthly-immunization/:id",
      this.validateRequest("param", GlobalIdRequestSchema),
      async (c) => {
        const params = c.req.valid("param")
        const entityId = Number(c.var.userEntity?.global_id || 0)
        const result = await this.module.getDetailMonthlyImmunization(
          c,
          params.id,
          entityId
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get("/achievements", async (c) => {
      const subDistrictId = Number(c.var.userEntity?.sub_district_id || 0)
      const entityId = Number(c.var.userEntity?.global_id || 0)
      const result = await this.module.getImmunizationAchievements(
        c,
        subDistrictId,
        entityId
      )
      return c.json(result, StatusCodes.OK)
    })

    router.get("/vial-needs", async (c) => {
      const subDistrictId = Number(c.var.userEntity?.sub_district_id || 0)
      const entityId = Number(c.var.userEntity?.global_id || 0)
      const result = await this.module.getVialNeedsBySchool(
        c,
        subDistrictId,
        entityId
      )
      return c.json(result, StatusCodes.OK)
    })

    router.get(
      "/vial-needs/:id",
      this.validateRequest("param", GlobalIdRequestSchema),
      async (c) => {
        const params = c.req.valid("param")
        const entityId = Number(c.var.userEntity?.global_id || 0)
        const result = await this.module.getDetailVialNeedsBySchool(
          c,
          params.id,
          entityId
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get("/vaccine-logistics-summary", async (c) => {
      const subDistrictId = Number(c.var.userEntity?.sub_district_id || 0)
      const entityId = Number(c.var.userEntity?.global_id || 0)
      const result = await this.module.getVaccineLogisticsSummary(
        c,
        subDistrictId,
        entityId
      )
      return c.json(result, StatusCodes.OK)
    })

    return router
  }
}
