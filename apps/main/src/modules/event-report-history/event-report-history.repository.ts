import { Context } from "hono"
import { BaseRepository } from "@/modules/base.repository.js"
export class EventReportHistoryRepository extends BaseRepository<"ws_event_report_histories"> {
  constructor(
    filterProgram = false,
    filterActivity = false,
    useSoftDelete = true,
    useAudit = false
  ) {
    super(
      "ws_event_report_histories",
      filterProgram,
      filterActivity,
      useSoftDelete,
      useAudit
    )
  }

  async getListHistoryChangeStatus(c: Context, reportId: number) {
    return await c.var.trx
      .selectFrom("ws_event_report_histories")
      .select(["id", "status_id", "created_by", "created_at"])
      .where("report_id", "=", reportId)
      .groupBy(["status_id"])
      .execute()
  }

  async getLatestStatusChangeHistory(c: Context, reportId: number) {
    return await c.var.trx
      .selectFrom("ws_event_report_histories")
      .select(["id", "status_id", "created_by", "created_at"])
      .where("report_id", "=", reportId)
      .orderBy("id", "desc")
      .executeTakeFirst()
  }
}
