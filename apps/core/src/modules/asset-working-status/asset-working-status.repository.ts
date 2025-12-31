import { GetAssetWorkingStatusPagination } from "@/modules/asset-working-status/asset-working-status.schema.js"
import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"

export class AssetWorkingStatusRepository extends BaseRepository<"asset_working_statuses"> {
  constructor() {
    super("asset_working_statuses")
  }

  async getListAssetWorkingStatus(
    c: Context,
    params: GetAssetWorkingStatusPagination
  ) {
    const { page, paginate } = params
    const offset = (page - 1) * paginate
    const [query, totalList] = await Promise.all([
      c.var.trx
        .selectFrom("asset_working_statuses")
        .select(["id", "name"])
        .limit(paginate)
        .offset(offset)
        .execute(),
      c.var.trx
        .selectFrom("asset_working_statuses")
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst(),
    ])

    return {
      list: query,
      total: Number(totalList?.total) || 0,
    }
  }
}
