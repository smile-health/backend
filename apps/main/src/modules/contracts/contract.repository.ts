import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
import { GetListContractQueries } from "./contract.schema.js"

export class ContractRepository extends BaseRepository<"ws_contracts"> {
  constructor() {
    super("ws_contracts", false, false)
  }

  async getList(c: Context, params: GetListContractQueries) {
    const programId = c.get("programId")
    const { page, paginate, keyword, is_available, commitment_id } = params
    const offset = (page - 1) * paginate
    let query
    console.log(is_available)

    if (is_available && is_available === 1) {
      // use in commitment
      query = c.var.trx
        .selectFrom("ws_contracts as wc")
        .leftJoin("ws_commitments as wc2", (join) =>
          join
            .onRef("wc.id", "=", "wc2.contract_id")
            .on("wc2.program_id", "=", programId)
        )

      if (commitment_id) {
        // use when edit commitment
        query = query.where((eb) =>
          eb.or([eb("wc2.id", "is", null), eb("wc2.id", "=", commitment_id)])
        )
      } else {
        // use when create commitment
        query = query.where("wc2.id", "is", null)
      }
    } else {
      // use in order or general besides commitment
      query = c.var.trx.selectFrom("ws_contracts as wc")
    }

    if (keyword) {
      query = query.where("wc.contract_number", "like", `%${keyword}%`)
    }

    const [list, count] = await Promise.all([
      query
        .where("wc.deleted_at", "is", null)
        .select([
          "wc.id",
          "wc.contract_number",
          "wc.created_at",
          "wc.updated_at",
          "wc.deleted_at",
          "wc.created_by",
          "wc.updated_by",
          "wc.deleted_by",
        ])
        .orderBy("wc.id")
        .limit(paginate)
        .offset(offset)
        .execute(),
      query
        .where("wc.deleted_at", "is", null)
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst(),
    ])

    return {
      list,
      total: Number(count?.total) || 0,
    }
  }
}
