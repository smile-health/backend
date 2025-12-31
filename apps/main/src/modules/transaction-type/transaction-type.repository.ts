import { db } from "@/common/infrastructure/database/index.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { BaseRepository } from "@smile/lib/base/repository.js"
import { Context } from "hono"
import { CompiledQuery } from "kysely"
import { ListTransactionTypeReasonDTO } from "../app-mobile-data/app-mobile-data.schema.js"

export class TransactionTypeRepository extends BaseRepository<
  DB,
  "ws_transaction_types"
> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_transaction_types", filterProgram, filterActivity)
  }

  async getTransactionTypeReasonByWorkspace(
    c: Context
  ): Promise<ListTransactionTypeReasonDTO | undefined> {
    const { rows } = await db.executeQuery<ListTransactionTypeReasonDTO>(
      CompiledQuery.raw("select get_transaction_types_reasons(?) as result", [
        c.var.programId,
      ])
    )

    return rows[0]
  }
}
