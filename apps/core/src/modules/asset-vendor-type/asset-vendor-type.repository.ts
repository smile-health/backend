import { GetAssetVendorTypesPagination } from "@/modules/asset-vendor-type/asset-vendor-type.schema.js"
import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"

export class AssetVendorTypeRepository extends BaseRepository<"asset_vendor_types"> {
  constructor() {
    super("asset_vendor_types")
  }

  async getListAssetVendorType(
    c: Context,
    params: GetAssetVendorTypesPagination
  ) {
    const { page, paginate } = params
    const offset = (page - 1) * paginate
    const [query, totalList] = await Promise.all([
      c.var.trx
        .selectFrom("asset_vendor_types")
        .select(["id", "name"])
        .limit(paginate)
        .offset(offset)
        .execute(),
      c.var.trx
        .selectFrom("asset_vendor_types")
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst(),
    ])

    return {
      list: query,
      total: Number(totalList?.total) || 0,
    }
  }
}
