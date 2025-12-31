import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { AssetWorkingStatusRepository } from "./asset-working-status.repository.js"
import { GetAssetWorkingStatusPagination } from "./asset-working-status.schema.js"

export class AssetWorkingStatusModule {
  constructor(private readonly repository: AssetWorkingStatusRepository) {}

  async list(c: Context, params: GetAssetWorkingStatusPagination) {
    const { list, total } = await this.repository.getListAssetWorkingStatus(
      c,
      params
    )

    const result = list.map(({ name, ...item }) => ({
      ...item,
      name: this.translateSmart(c, String(name)),
    }))

    return new PaginatedResponse(params, result, total)
  }

  private translateSmart(c: Context, input: string) {
    const prefix = "asset_working_status.label."

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