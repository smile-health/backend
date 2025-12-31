import { GetAssetElectricitysPagination } from "@/modules/asset-electricity/asset-electricity.schema.js"
import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"

export class AssetElectricityRepository extends BaseRepository<"ws_asset_electricities"> {
  constructor() {
    super("ws_asset_electricities")
  }

  async getListAssetElectricity(
    c: Context,
    params: GetAssetElectricitysPagination
  ) {
    const { page, paginate } = params
    const offset = (page - 1) * paginate
    const [query, totalList] = await Promise.all([
      c.var.trx
        .selectFrom("ws_asset_electricities")
        .select(["id", "name"])
        .limit(paginate)
        .offset(offset)
        .execute(),
      c.var.trx
        .selectFrom("ws_asset_electricities")
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst(),
    ])

    return {
      list: query,
      total: Number(totalList?.total) || 0,
    }
  }
}
