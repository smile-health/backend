import { GetAssetMaintenanceSchedulePagination } from "@/modules/asset-maintenance-schedule/asset-maintenance-schedule.schema.js"
import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"

export class AssetMaintenanceScheduleRepository extends BaseRepository<"asset_maintenance_schedules"> {
  constructor() {
    super("asset_maintenance_schedules")
  }

  async getListAssetMaintenanceSchedule(
    c: Context,
    params: GetAssetMaintenanceSchedulePagination
  ) {
    const { page, paginate } = params
    const offset = (page - 1) * paginate
    const [query, totalList] = await Promise.all([
      c.var.trx
        .selectFrom("asset_maintenance_schedules")
        .select(["id", "name"])
        .limit(paginate)
        .offset(offset)
        .execute(),
      c.var.trx
        .selectFrom("asset_maintenance_schedules")
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst(),
    ])

    return {
      list: query,
      total: Number(totalList?.total) || 0,
    }
  }
}
