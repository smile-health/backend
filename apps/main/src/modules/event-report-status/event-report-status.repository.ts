import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
export class EventReportStatusRepository extends BaseRepository<"ws_event_report_status"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_event_report_status", filterProgram, filterActivity)
  }

  async getEventReportStatusesByIds(c: Context, ids: number[]) {
    return c.var.trx
      .selectFrom("ws_event_report_status")
      .select(["id", "title"])
      .where("id", "in", ids)
      .execute()
  }
}
