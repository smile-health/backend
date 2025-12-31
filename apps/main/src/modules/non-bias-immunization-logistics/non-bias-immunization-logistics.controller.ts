import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { NonBiasImmunizationLogisticsModule } from "./non-bias-immunization-logistics.module.js"
import {
  DataCheckerQuerySchema,
  NonBiasCalculateDetailQuerySchema,
  RecalculateVillageEstimationSchema,
  SaveNonBiasImmunizationLogisticsSchema,
  SaveVillageImmunizationAchievementSchema,
  UpdateNonBiasImmunizationLogisticsSchema,
} from "./non-bias-immunization-logistics.schema.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { TransactionMiddleware } from "@smile/lib/middlewares/transaction.middleware.js"

export class NonBiasImmunizationLogisticsController extends BaseController {
  constructor(
    private readonly module: NonBiasImmunizationLogisticsModule,
    private readonly trxMiddleware: TransactionMiddleware<DB>
  ) {
    super()
  }

  readonly #getSubDistrictId = (c: any) =>
    Number(c.var.userEntity?.sub_district_id || 0)

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/calculate-detail",
      this.validateRequest("query", NonBiasCalculateDetailQuerySchema),
      async (c) => {
        const query = c.req.valid("query")
        const result = await this.module.getCalculateDetail(c, query)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.post(
      "/calculate-immunization-data",
      this.validateRequest("json", SaveVillageImmunizationAchievementSchema),
      async (c) => {
        const body = c.req.valid("json")
        const result = await this.module.saveVillageImmunizationData(c, body)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.post(
      "/recalculate-estimation",
      this.validateRequest("json", RecalculateVillageEstimationSchema),
      async (c) => {
        const body = c.req.valid("json")
        const result = await this.module.recalculateVillageEstimation(c, body)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.post(
      "/save-logistics-data",
      this.trxMiddleware.handle,
      this.validateRequest("json", SaveNonBiasImmunizationLogisticsSchema),
      async (c) => {
        const body = c.req.valid("json")
        const result = await this.module.saveNonBiasImmunizationLogistics(
          c,
          body
        )
        return c.json(result, StatusCodes.CREATED)
      }
    )

    router.get(
      "/menu-checker",
      this.validateRequest("query", DataCheckerQuerySchema),
      async (c) => {
        const { keyword } = c.req.valid("query")
        const result = await this.module.getDataChecker(
          c,
          this.#getSubDistrictId(c),
          keyword
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.put(
      "/:village_id",
      this.trxMiddleware.handle,
      this.validateRequest("json", UpdateNonBiasImmunizationLogisticsSchema),
      async (c) => {
        const villageId = Number(c.req.param("village_id"))
        const body = c.req.valid("json")
        const result = await this.module.updateNonBiasImmunizationLogistics(
          c,
          villageId,
          body
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
