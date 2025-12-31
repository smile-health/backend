import { InsertObject, sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const EventReportStatusData = [
    {
      id: 1,
      title: "submitted",
    },
    {
      id: 2,
      title: "reviewed_by_helpdesk",
    },
    {
      id: 3,
      title: "reported_to_province",
    },
    {
      id: 4,
      title: "reported_to_supplier",
    },
    {
      id: 5,
      title: "manual_input",
    },
    {
      id: 6,
      title: "in_supplier_inspection",
    },
    {
      id: 7,
      title: "revised",
    },
    {
      id: 8,
      title: "revision_check",
    },
    {
      id: 9,
      title: "report_completed",
    },
    {
      id: 10,
      title: "report_canceled",
    },
  ]

  await db
    .insertInto("ws_event_report_status")
    .values(
      EventReportStatusData as unknown as InsertObject<
        Database,
        "ws_event_report_status"
      >[]
    )
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`truncate table ws_event_report_status`.execute(db)
}
