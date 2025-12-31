import { InsertObject, sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const EventReportReasonData = [
    {
      id: 1,
      parent_id: null,
      title: "receive_from_central",
      program_id: 2,
    },
    {
      id: 2,
      parent_id: 1,
      title: "different_batch_than_received",
      program_id: 2,
    },
    {
      id: 3,
      parent_id: 1,
      title: "not_yet_entered_in_smile",
      program_id: 2,
    },
  ]

  await db
    .insertInto("ws_event_report_reasons")
    .values(
      EventReportReasonData as unknown as InsertObject<
        Database,
        "ws_event_report_reasons"
      >[]
    )
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`truncate table ws_event_report_reasons`.execute(db)
}
