import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const TABLE_NAME = "rabies_vaccine_rules"

export async function seed(db: Kysely<Database>): Promise<void> {
  const vaccineRules = [
    {
      id: 1,
      type_id: 1,
      method_id: 1,
      title: "PrEP Hari 0",
      min: 1,
      max: 1,
      previous_sequence: null,
      active_duration: null,
      next_sequence: "2,5,8",
      start_notification: 7,
      end_notification: 14,
      prerequisite_qty: null,
    },
    {
      id: 2,
      type_id: 1,
      method_id: 1,
      title: "PrEP Hari 7",
      min: 1,
      max: 1,
      previous_sequence: 1,
      active_duration: null,
      next_sequence: "11,13",
      start_notification: null,
      end_notification: null,
      prerequisite_qty: null,
    },
    {
      id: 3,
      type_id: 1,
      method_id: 2,
      title: "PrEP Hari 0",
      min: 1,
      max: 2,
      previous_sequence: null,
      active_duration: null,
      next_sequence: "4,5,8,11,13",
      start_notification: 7,
      end_notification: 14,
      prerequisite_qty: null,
    },
    {
      id: 4,
      type_id: 1,
      method_id: 2,
      title: "PrEP Hari 7",
      min: 1,
      max: 2,
      previous_sequence: 3,
      active_duration: null,
      next_sequence: "11,13",
      start_notification: null,
      end_notification: null,
      prerequisite_qty: null,
    },
    {
      id: 5,
      type_id: 2,
      method_id: 1,
      title: "PEP Hari 0",
      min: 2,
      max: 2,
      previous_sequence: null,
      active_duration: 31,
      next_sequence: "6,11,13",
      start_notification: 7,
      end_notification: 14,
      prerequisite_qty: null,
    },
    {
      id: 6,
      type_id: 2,
      method_id: 1,
      title: "PEP Hari 7",
      min: 1,
      max: 1,
      previous_sequence: 5,
      active_duration: 22,
      next_sequence: "7,11,13",
      start_notification: 14,
      end_notification: 21,
      prerequisite_qty: null,
    },
    {
      id: 7,
      type_id: 2,
      method_id: 1,
      title: "PEP Hari 21/28",
      min: 1,
      max: 1,
      previous_sequence: 6,
      active_duration: 360,
      next_sequence: "11,13",
      start_notification: null,
      end_notification: null,
      prerequisite_qty: null,
    },
    {
      id: 8,
      type_id: 2,
      method_id: 2,
      title: "PEP Hari 0",
      min: 1,
      max: 2,
      previous_sequence: null,
      active_duration: 31,
      next_sequence: "9,11,13",
      start_notification: 7,
      end_notification: 14,
      prerequisite_qty: null,
    },
    {
      id: 9,
      type_id: 2,
      method_id: 2,
      title: "PEP Hari 3",
      min: 1,
      max: 2,
      previous_sequence: 8,
      active_duration: 22,
      next_sequence: "10,11,13",
      start_notification: 14,
      end_notification: 21,
      prerequisite_qty: null,
    },
    {
      id: 10,
      type_id: 2,
      method_id: 2,
      title: "PEP Hari 7",
      min: 1,
      max: 2,
      previous_sequence: 9,
      active_duration: 360,
      next_sequence: "11,13",
      start_notification: null,
      end_notification: null,
      prerequisite_qty: null,
    },
    {
      id: 11,
      type_id: 3,
      method_id: 1,
      title: "Booster I Hari 0",
      min: 1,
      max: 1,
      previous_sequence: 7,
      active_duration: 360,
      next_sequence: "12",
      start_notification: 3,
      end_notification: 7,
      prerequisite_qty: 2,
    },
    {
      id: 12,
      type_id: 3,
      method_id: 1,
      title: "Booster II Hari 3",
      min: 1,
      max: 1,
      previous_sequence: 11,
      active_duration: 360,
      next_sequence: null,
      start_notification: null,
      end_notification: null,
      prerequisite_qty: null,
    },
    {
      id: 13,
      type_id: 3,
      method_id: 2,
      title: "Booster I Hari 0",
      min: 1,
      max: 1,
      previous_sequence: 10,
      active_duration: 360,
      next_sequence: "14",
      start_notification: 3,
      end_notification: 7,
      prerequisite_qty: 2,
    },
    {
      id: 14,
      type_id: 3,
      method_id: 2,
      title: "Booster II Hari 3",
      min: 1,
      max: 1,
      previous_sequence: 13,
      active_duration: 360,
      next_sequence: null,
      start_notification: null,
      end_notification: null,
      prerequisite_qty: null,
    },
  ]

  const existingRecords = await db
    .selectFrom(TABLE_NAME)
    .select(["id"])
    .where(
      "id",
      "in",
      vaccineRules.map((rule) => rule.id)
    )
    .execute()

  const existingIds = new Set(existingRecords.map((entry) => entry.id))

  const updates = existingRecords.map((entry) => ({
    id: entry.id,
    ...vaccineRules.find((rule) => rule.id === entry.id),
  }))

  const inserts = vaccineRules.filter((rule) => !existingIds.has(rule.id))

  for (const update of updates) {
    await db
      .updateTable(TABLE_NAME)
      .set(update)
      .where("id", "=", update.id)
      .execute()
  }

  if (inserts.length > 0) {
    await db.insertInto(TABLE_NAME).values(inserts).execute()
  }
}
