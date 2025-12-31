import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
export class EventReportItemRepository extends BaseRepository<"ws_event_report_items"> {
  constructor(
    filterProgram = false,
    filterActivity = false,
    useSoftDelete = true,
    useAudit = false
  ) {
    super(
      "ws_event_report_items",
      filterProgram,
      filterActivity,
      useSoftDelete,
      useAudit
    )
  }

  async getEventReportItemsByReportId(c: Context, reportId: number) {
    return await c.var.trx
      .selectFrom("ws_event_report_items as weri")
      .leftJoin("ws_materials as wm", (join) =>
        join.onRef("weri.material_id", "=", "wm.id")
      )
      .where("weri.report_id", "=", reportId)
      .select([
        "weri.id",
        "weri.material_id",
        "weri.custom_material",
        "weri.no_batch as batch_code",
        "weri.expired_date",
        "weri.production_date",
        "weri.reason_id",
        "weri.child_reason_id",
        "weri.qty",
        "weri.created_at",
        "weri.updated_at",
        "weri.created_by",
        "wm.name as material_name",
      ])
      .execute()
  }
}
