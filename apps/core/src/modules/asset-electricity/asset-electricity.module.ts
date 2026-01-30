import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { AssetElectricityRepository } from "./asset-electricity.repository.js"
import { GetAssetElectricityPagination } from "./asset-electricity.schema.js"

export class AssetElectricityModule {
  constructor(private readonly repository: AssetElectricityRepository) {}

  async list(c: Context, params: GetAssetElectricityPagination) {
    const { list, total } = await this.repository.getListAssetElectricity(
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
    const prefix = "asset_electricity.label."

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