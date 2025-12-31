import { DB } from "@/common/infrastructure/database/types/db.js"
import { Insertable, Kysely, sql } from "kysely"

type Trx = Kysely<DB>

type IntegrationAsikAggregateInsert = Insertable<
  DB["integration_asik_aggregate"]
>

type BatchRow = {
  id: number
  code: string
}

export class AsikRepository {
  async getLastSavedPage(trx: Trx, inputDate: Date): Promise<number | null> {
    const row = await trx
      .selectFrom("integration_asik_aggregate")
      .select((eb) => eb.fn.max("page").as("max_page"))
      .where("input_date", "=", inputDate)
      .executeTakeFirst()

    const maxPage = row?.max_page
    if (maxPage === null || maxPage === undefined) return null

    return Number(maxPage)
  }

  async findBatchesByCodes(trx: Trx, codes: string[]): Promise<BatchRow[]> {
    if (!codes.length) return []

    return await trx
      .selectFrom("ws_batches")
      .select(["id", "code"])
      .where("code", "in", codes)
      .execute()
  }

  async findMaterialIdByNameLike(
    trx: Trx,
    name: string
  ): Promise<number | null> {
    const row = await trx
      .selectFrom("materials")
      .select(["id"])
      .where("deleted_at", "is", null)
      .where("name", "like", `%${name}%`)
      .executeTakeFirst()

    return row?.id ?? null
  }

  async upsertAggregates(trx: Trx, rows: IntegrationAsikAggregateInsert[]) {
    if (!rows.length) return

    await trx
      .insertInto("integration_asik_aggregate")
      .values(rows)
      .onDuplicateKeyUpdate(() => ({
        updated_at: sql`NOW()`,
      }))
      .execute()
  }
}
