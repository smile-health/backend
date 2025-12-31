import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BiasImmunizationLogisticsModule } from "./bias-immunization-logistics.module.js"
import {
  BiasCalculateDetailQuerySchema,
  DataCheckerQuerySchema,
  RecalculateEstimationSchema,
  SaveBiasImmunizationLogisticsSchema,
  SaveImmunizationAchievementSchema,
  UpdateBiasImmunizationLogisticsSchema,
} from "./bias-immunization-logistics.schema.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { TransactionMiddleware } from "@smile/lib/middlewares/transaction.middleware.js"

export class BiasImmunizationLogisticsController extends BaseController {
  constructor(
    private readonly module: BiasImmunizationLogisticsModule,
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
      this.validateRequest("query", BiasCalculateDetailQuerySchema),
      async (c) => {
        const query = c.req.valid("query")
        const result = await this.module.getCalculateDetail(c, query)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.post(
      "/calculate-immunization-data",
      this.validateRequest("json", SaveImmunizationAchievementSchema),
      async (c) => {
        const body = c.req.valid("json")
        const result = await this.module.saveImmunizationData(c, body)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.post(
      "/recalculate-estimation",
      this.validateRequest("json", RecalculateEstimationSchema),
      async (c) => {
        const body = c.req.valid("json")
        const result = await this.module.recalculateEstimation(c, body)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.post(
      "/save-logistics-data",
      this.trxMiddleware.handle,
      this.validateRequest("json", SaveBiasImmunizationLogisticsSchema),
      async (c) => {
        const body = c.req.valid("json")
        const result = await this.module.saveBiasImmunizationLogistics(c, body)
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
      "/:school_id",
      this.trxMiddleware.handle,
      this.validateRequest("json", UpdateBiasImmunizationLogisticsSchema),
      async (c) => {
        const schoolId = Number(c.req.param("school_id"))
        const body = c.req.valid("json")
        const result = await this.module.updateBiasImmunizationLogistics(
          c,
          schoolId,
          body
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
