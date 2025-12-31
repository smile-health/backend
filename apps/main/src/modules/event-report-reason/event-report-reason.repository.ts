import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
import { EventReportReasonListDTO } from "./event-report-reason.schema.js"

export class EventReportReasonRepository extends BaseRepository<"ws_event_report_reasons"> {
  constructor() {
    super("ws_event_report_reasons")
  }

  async getEventReportReason(c: Context, programId: number, ids?: number[]) {
    const rows = await c.var.trx
      .selectFrom("ws_event_report_reasons as wser")
      .innerJoin("ws_event_report_reasons as wserp", (join) =>
        join
          .onRef("wserp.parent_id", "=", "wser.id")
          .on("wserp.deleted_at", "is", null)
          .on("wserp.is_active", "=", 1)
          .on("wserp.program_id", "=", programId)
      )
      .where("wser.program_id", "=", programId)
      .where("wser.deleted_at", "is", null)
      .where("wser.is_active", "=", 1)
      .$if(ids !== undefined && ids !== null && ids.length > 0, (qb) =>
        qb.where("wser.id", "in", ids as number[])
      )
      .select([
        "wser.id",
        "wser.parent_id",
        "wser.title as parent_title",
        "wserp.id as child_id",
        "wserp.title as child_title",
      ])
      .execute()

    return this.structuredReason(c, rows)
  }

  private structuredReason(c: Context, rows: EventReportReasonListDTO[]) {
    const structured = Object.values(
      rows.reduce(
        (acc, row) => {
          if (!acc[row.id]) {
            acc[row.id] = {
              id: row.id,
              title: c.var.t(`event_report.label.${row.parent_title}`),
              child: [],
            }
          }

          if (row.child_id) {
            acc[row.id]?.child.push({
              id: row.child_id,
              title: c.var.t(`event_report.label.${row.child_title}`),
            })
          }

          return acc
        },
        {} as Record<
          number,
          {
            id: number
            title: string
            child: { id: number; title: string }[]
          }
        >
      )
    )

    return structured
  }
}
