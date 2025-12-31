import { Context } from "hono"
import { EventReportStatusRepository } from "./event-report-status.repository.js"

export class EventReportStatusModule {
  constructor(private readonly repository: EventReportStatusRepository) {}

  async list(c: Context) {
    const data = await this.repository.find(c, {})

    const res = data.map((res) => ({
      id: res.id,
      title: c.var.t(`event_report.label.${res.title}`),
    }))

    return res
  }
}
