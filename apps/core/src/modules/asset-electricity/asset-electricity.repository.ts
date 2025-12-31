import { GetAssetElectricityPagination } from "@/modules/asset-electricity/asset-electricity.schema.js"
import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"

export class AssetElectricityRepository extends BaseRepository<"asset_electricities"> {
  constructor() {
    super("asset_electricities")
  }

  async getListAssetElectricity(
    c: Context,
    params: GetAssetElectricityPagination
  ) {
    const { page, paginate } = params
    const offset = (page - 1) * paginate
    const [query, totalList] = await Promise.all([
      c.var.trx
        .selectFrom("asset_electricities")
        .select(["id", "name"])
        .limit(paginate)
        .offset(offset)
        .execute(),
      c.var.trx
        .selectFrom("asset_electricities")
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst(),
    ])

    return {
      list: query,
      total: Number(totalList?.total) || 0,
    }
  }
}
