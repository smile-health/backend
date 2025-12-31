import { InsertObject, sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const EventReportReasonData = [
    { id: 1, parent_id: null, title: "receive_from_central", program_id: 2 },
    {
      id: 2,
      parent_id: 1,
      title: "different_batch_than_received",
      program_id: 2,
    },
    { id: 3, parent_id: 1, title: "not_yet_entered_in_smile", program_id: 2 },
    { id: 4, parent_id: null, title: "receive_from_central", program_id: 3 },
    {
      id: 5,
      parent_id: 4,
      title: "different_batch_than_received",
      program_id: 3,
    },
    { id: 6, parent_id: 4, title: "not_yet_entered_in_smile", program_id: 3 },
    { id: 7, parent_id: null, title: "receive_from_central", program_id: 4 },
    {
      id: 8,
      parent_id: 7,
      title: "different_batch_than_received",
      program_id: 4,
    },
    { id: 9, parent_id: 7, title: "not_yet_entered_in_smile", program_id: 4 },
    { id: 10, parent_id: null, title: "receive_from_central", program_id: 5 },
    {
      id: 11,
      parent_id: 10,
      title: "different_batch_than_received",
      program_id: 5,
    },
    { id: 12, parent_id: 10, title: "not_yet_entered_in_smile", program_id: 5 },
    { id: 13, parent_id: null, title: "receive_from_central", program_id: 9 },
    {
      id: 14,
      parent_id: 13,
      title: "different_batch_than_received",
      program_id: 9,
    },
    { id: 15, parent_id: 13, title: "not_yet_entered_in_smile", program_id: 9 },
  ]

  const idsToInsert = EventReportReasonData.map((item) => item.id)

  const existingIds = await db
    .selectFrom("ws_event_report_reasons")
    .select("id")
    .where("id", "in", idsToInsert)
    .execute()
    .then((rows) => rows.map((row) => row.id))

  const newRecords = EventReportReasonData.filter(
    (item) => !existingIds.includes(item.id)
  )

  if (newRecords.length > 0) {
    await db
      .insertInto("ws_event_report_reasons")
      .values(newRecords as InsertObject<Database, "ws_event_report_reasons">[])
      .execute()
  }
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`TRUNCATE TABLE ws_event_report_reasons RESTART IDENTITY CASCADE`.execute(
    db
  )
}
