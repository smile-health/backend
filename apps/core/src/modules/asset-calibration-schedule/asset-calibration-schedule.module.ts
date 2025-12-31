import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { AssetCalibrationScheduleRepository } from "./asset-calibration-schedule.repository.js"
import { GetAssetCalibrationSchedulePagination } from "./asset-calibration-schedule.schema.js"

export class AssetCalibrationScheduleModule {
  constructor(
    private readonly repository: AssetCalibrationScheduleRepository
  ) {}

  async list(c: Context, params: GetAssetCalibrationSchedulePagination) {
    const { list, total } =
      await this.repository.getListAssetCalibrationSchedule(c, params)

    const result = list.map(({ name, ...item }) => ({
      ...item,
      name: this.translateSmart(c, String(name)),
    }))

    return new PaginatedResponse(params, result, total)
  }

  private translateSmart(c: Context, input: string) {
    const prefix = "asset_calibration_schedule.label."

    if (input.startsWith(prefix)) {
      return c.var.t(input)
    }

    const translated = c.var.t(prefix + input)

    if (translated !== prefix + input) {
      return translated
    }

    return input
  }
}