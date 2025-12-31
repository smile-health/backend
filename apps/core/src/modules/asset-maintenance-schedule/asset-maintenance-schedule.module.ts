import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { AssetMaintenanceScheduleRepository } from "./asset-maintenance-schedule.repository.js"
import { GetAssetMaintenanceSchedulePagination } from "./asset-maintenance-schedule.schema.js"

export class AssetMaintenanceScheduleModule {
  constructor(
    private readonly repository: AssetMaintenanceScheduleRepository
  ) {}

  async list(c: Context, params: GetAssetMaintenanceSchedulePagination) {
    const { list, total } =
      await this.repository.getListAssetMaintenanceSchedule(c, params)

    const result = list.map(({ name, ...item }) => ({
      ...item,
      name: this.translateSmart(c, String(name)),
    }))

    return new PaginatedResponse(params, result, total)
  }

  private translateSmart(c: Context, input: string) {
    const prefix = "asset_maintenance_schedule.label."

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