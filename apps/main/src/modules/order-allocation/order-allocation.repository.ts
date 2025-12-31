import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
export class OrderAllocationRepository extends BaseRepository<"ws_orders"> {
  constructor(filterProgram = false, filterActivity = true) {
    super("ws_orders", filterProgram, filterActivity)
  }

  async getCheckStockByIds(
    c: Context,
    stock_ids: number[],
    activity_ids: number[],
    programId: number,
    entity_id: number,
    material_ids: number[]
  ) {
    return await c.var.trx
      .selectFrom("ws_activities as wsa")
      .leftJoin("ws_stocks as wss", (join) =>
        join
          .onRef("wsa.id", "=", "wss.activity_id")
          .on("wss.deleted_at", "is", null)
      )
      .leftJoin("ws_materials as wsm", (join) =>
        join
          .onRef("wsm.id", "=", "wss.material_id")
          .on("wsm.deleted_at", "is", null)
      )
      .select([
        "wss.activity_id",
        "wss.qty",
        "wsm.name",
        "wss.id",
        "wss.material_id",
        "wss.allocated_qty",
      ])
      .where("wss.id", "in", stock_ids)
      .where("wsa.program_id", "=", programId)
      .where("wss.entity_id", "=", entity_id)
      .where("wss.activity_id", "in", activity_ids)
      .where("wss.material_id", "in", material_ids)
      .execute()
  }

  async updateStockById(c: Context, stock_id: number, qty: number) {
    return await c.var.trx
      .updateTable("ws_stocks")
      .set((eb) => ({
        allocated_qty: eb("allocated_qty", "+", qty),
        updated_at: new Date(),
      }))
      .where("id", "=", stock_id)
      .executeTakeFirst()
  }

  async getWSEntityActivitiesByActivityIdAndEntityId(
    c: Context,
    activityIds: number[],
    entityId: number
  ) {
    const today = new Date().toISOString().split("T")[0]
    return c.var.trx
      .selectFrom("ws_entity_activities as wea")
      .selectAll("wea")
      .where("wea.activity_id", "in", activityIds)
      .where("wea.entity_id", "=", entityId)
      .where((eb) =>
        eb.or([eb("wea.end_date", ">=", today), eb("wea.end_date", "is", null)])
      )
      .where("wea.start_date", "<=", today)
      .execute()
  }
}
