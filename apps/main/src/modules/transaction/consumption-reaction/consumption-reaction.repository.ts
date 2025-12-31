import { Context } from "hono"

export class ConsumptionReactionRepository {
  async findConsumptionById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_consumptions as wc")
      .innerJoin("ws_transactions as wt", "wc.transaction_id", "wt.id")
      .innerJoin("ws_activities as a", "wt.activity_id", "a.id")
      .select(["wc.id", "wt.actual_transaction_date"])
      .where("wc.id", "=", id)
      .where("wc.deleted_at", "is", null)
      .where("a.program_id", "=", c.var.programId)
      .executeTakeFirst()
  }

  async findReactionById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("reactions")
      .select(["id"]) // minimal select
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async create(
    c: Context,
    data: {
      consumption_id: number
      reaction_id: number
      other_reaction?: string
      actual_date: Date | string
    }
  ) {
    return await c.var.trx
      .insertInto("ws_consumption_reactions")
      .values({
        consumption_id: data.consumption_id,
        reaction_id: data.reaction_id,
        other_reaction: data.other_reaction ?? null,
        actual_date: data.actual_date as Date,
        created_by: c.var.userId ?? null,
        updated_by: c.var.userId ?? null,
      })
      .executeTakeFirstOrThrow()
  }
}
