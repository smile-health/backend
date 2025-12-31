import { GetAssetCalibrationSchedulePagination } from "@/modules/asset-calibration-schedule/asset-calibration-schedule.schema.js"
import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"

export class AssetCalibrationScheduleRepository extends BaseRepository<"asset_calibration_schedules"> {
  constructor() {
    super("asset_calibration_schedules")
  }

  async getListAssetCalibrationSchedule(
    c: Context,
    params: GetAssetCalibrationSchedulePagination
  ) {
    const { page, paginate } = params
    const offset = (page - 1) * paginate
    const [query, totalList] = await Promise.all([
      c.var.trx
        .selectFrom("asset_calibration_schedules")
        .select(["id", "name"])
        .limit(paginate)
        .offset(offset)
        .execute(),
      c.var.trx
        .selectFrom("asset_calibration_schedules")
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst(),
    ])

    return {
      list: query,
      total: Number(totalList?.total) || 0,
    }
  }
}
