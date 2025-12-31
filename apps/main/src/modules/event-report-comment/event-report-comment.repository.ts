import { BaseRepository } from "../base.repository.js"
export class EventReportCommentRepository extends BaseRepository<"ws_event_report_comments"> {
  constructor(
    filterProgram = false,
    filterActivity = false,
    useSoftDelete = true,
    useAudit = false
  ) {
    super(
      "ws_event_report_comments",
      filterProgram,
      filterActivity,
      useSoftDelete,
      useAudit
    )
  }
}
