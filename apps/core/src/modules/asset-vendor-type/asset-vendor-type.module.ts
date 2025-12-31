import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { AssetVendorTypeRepository } from "./asset-vendor-type.repository.js"
import { GetAssetVendorTypesPagination } from "./asset-vendor-type.schema.js"

export class AssetVendorTypeModule {
  constructor(private readonly repository: AssetVendorTypeRepository) {}

  async list(c: Context, params: GetAssetVendorTypesPagination) {
    const { list, total } = await this.repository.getListAssetVendorType(
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
    const prefix = "asset_vendor_type.label."

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
