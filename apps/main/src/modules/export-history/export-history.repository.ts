import { db } from "@/common/infrastructure/database/index.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { BaseRepository } from "../base.repository.js"
import { sql } from "kysely"

export default class ExportHistoryRepository extends BaseRepository<"export_histories"> {
  constructor() {
    super("export_histories", false, false, true, false)
  }

  async upsert(c: Context<DB>, data, id?: number) {
    if (id) {
      await db
        .updateTable("export_histories")
        .set(data)
        .where("id", "=", id)
        .executeTakeFirst()
      return { id }
    }

    if (!data.original_filename || !data.filename || !data.created_by) {
      throw new Error("Missing required fields for creating export history")
    }

    return await c.var.trx
      .insertInto("export_histories")
      .values(data)
      .executeTakeFirst()
  }

  async updateStatusFailed() {
    // Will update status of export history to failed that has been in queue or in progress more than 6 hours
    await db
      .updateTable("export_histories")
      .set({ status: "failed" })
      .where("updated_at", "<=", sql<Date>`NOW() - INTERVAL 6 HOUR`)
      .where((eb) =>
        eb.or([eb("status", "=", "in_queue"), eb("status", "=", "in_progress")])
      )
      .executeTakeFirst()
  }
}
