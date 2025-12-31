import { InsertObject, Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
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
    // ================= PROGRAM 1 =================
    {
      id: 16,
      parent_id: null,
      title: "receipt_from_biofarma_hub",
      program_id: 1,
    },
    {
      id: 17,
      parent_id: 16,
      title: "different_batch_than_received",
      program_id: 1,
    },
    {
      id: 18,
      parent_id: 16,
      title: "different_dose_than_received",
      program_id: 1,
    },
    { id: 19, parent_id: 16, title: "not_yet_entered_in_smile", program_id: 1 },
    {
      id: 20,
      parent_id: 16,
      title: "different_expiry_date_than_received",
      program_id: 1,
    },

    { id: 21, parent_id: null, title: "receipt_from_province", program_id: 1 },
    {
      id: 22,
      parent_id: 21,
      title: "different_batch_than_received",
      program_id: 1,
    },
    {
      id: 23,
      parent_id: 21,
      title: "different_dose_than_received",
      program_id: 1,
    },
    { id: 24, parent_id: 21, title: "not_yet_entered_in_smile", program_id: 1 },
    {
      id: 25,
      parent_id: 21,
      title: "different_expiry_date_than_received",
      program_id: 1,
    },

    { id: 26, parent_id: null, title: "receipt_from_others", program_id: 1 },
    { id: 27, parent_id: 26, title: "received_from_tni", program_id: 1 },
    { id: 28, parent_id: 26, title: "received_from_polri", program_id: 1 },
    { id: 29, parent_id: 26, title: "received_from_bin", program_id: 1 },
    { id: 30, parent_id: 26, title: "received_from_others", program_id: 1 },

    // ================= PROGRAM 6 =================
    {
      id: 31,
      parent_id: null,
      title: "receipt_from_biofarma_hub",
      program_id: 6,
    },
    {
      id: 32,
      parent_id: 31,
      title: "different_batch_than_received",
      program_id: 6,
    },
    {
      id: 33,
      parent_id: 31,
      title: "different_dose_than_received",
      program_id: 6,
    },
    { id: 34, parent_id: 31, title: "not_yet_entered_in_smile", program_id: 6 },
    {
      id: 35,
      parent_id: 31,
      title: "different_expiry_date_than_received",
      program_id: 6,
    },

    { id: 36, parent_id: null, title: "receipt_from_province", program_id: 6 },
    {
      id: 37,
      parent_id: 36,
      title: "different_batch_than_received",
      program_id: 6,
    },
    {
      id: 38,
      parent_id: 36,
      title: "different_dose_than_received",
      program_id: 6,
    },
    { id: 39, parent_id: 36, title: "not_yet_entered_in_smile", program_id: 6 },
    {
      id: 40,
      parent_id: 36,
      title: "different_expiry_date_than_received",
      program_id: 6,
    },

    { id: 41, parent_id: null, title: "receipt_from_others", program_id: 6 },
    { id: 42, parent_id: 41, title: "received_from_tni", program_id: 6 },
    { id: 43, parent_id: 41, title: "received_from_polri", program_id: 6 },
    { id: 44, parent_id: 41, title: "received_from_bin", program_id: 6 },
    { id: 45, parent_id: 41, title: "received_from_others", program_id: 6 },

    // ================= PROGRAM 8 =================
    {
      id: 46,
      parent_id: null,
      title: "receipt_from_biofarma_hub",
      program_id: 8,
    },
    {
      id: 47,
      parent_id: 46,
      title: "different_batch_than_received",
      program_id: 8,
    },
    {
      id: 48,
      parent_id: 46,
      title: "different_dose_than_received",
      program_id: 8,
    },
    { id: 49, parent_id: 46, title: "not_yet_entered_in_smile", program_id: 8 },
    {
      id: 50,
      parent_id: 46,
      title: "different_expiry_date_than_received",
      program_id: 8,
    },

    { id: 51, parent_id: null, title: "receipt_from_province", program_id: 8 },
    {
      id: 52,
      parent_id: 51,
      title: "different_batch_than_received",
      program_id: 8,
    },
    {
      id: 53,
      parent_id: 51,
      title: "different_dose_than_received",
      program_id: 8,
    },
    { id: 54, parent_id: 51, title: "not_yet_entered_in_smile", program_id: 8 },
    {
      id: 55,
      parent_id: 51,
      title: "different_expiry_date_than_received",
      program_id: 8,
    },

    { id: 56, parent_id: null, title: "receipt_from_others", program_id: 8 },
    { id: 57, parent_id: 56, title: "received_from_tni", program_id: 8 },
    { id: 58, parent_id: 56, title: "received_from_polri", program_id: 8 },
    { id: 59, parent_id: 56, title: "received_from_bin", program_id: 8 },
    { id: 60, parent_id: 56, title: "received_from_others", program_id: 8 },
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
