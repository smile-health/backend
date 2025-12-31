import { Context } from "hono"
import { EventReportReasonRepository } from "./event-report-reason.repository.js"
export class EventReportReasonModule {
  constructor(
    private readonly eventReportReasonRepo: EventReportReasonRepository
  ) {}

  async list(c: Context) {
    const programId = Number(c.var.programId)

    return await this.eventReportReasonRepo.getEventReportReason(c, programId)
  }
}
