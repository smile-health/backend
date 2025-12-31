import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const disposalMethods = [
    { id: 1, title: "disposal_shipments", status: 0 },
    { id: 2, title: "trial", status: 0 },
    { id: 3, title: "self_disposal", status: 0 },
    { id: 4, title: "landfill", status: 1 },
    { id: 5, title: "incineration", status: 1 },
    { id: 6, title: "sterilization", status: 1 },
  ]

  await db
    .insertInto("ws_disposal_methods")
    .values(disposalMethods)
    .onDuplicateKeyUpdate({
      title: sql`values(title)`,
      status: sql`values(status)`,
    })
    .execute()

  const disposalMethodReasons = [
    { id: 1, disposal_method_id: 3, transaction_reason_id: 10 },
    { id: 2, disposal_method_id: 2, transaction_reason_id: 10 },
    { id: 3, disposal_method_id: 1, transaction_reason_id: 13 },
    { id: 4, disposal_method_id: 1, transaction_reason_id: 9 },
    { id: 5, disposal_method_id: 1, transaction_reason_id: 12 },
  ]

  await db
    .insertInto("ws_disposal_method_reasons")
    .values(disposalMethodReasons)
    .onDuplicateKeyUpdate({
      disposal_method_id: sql`values(disposal_method_id)`,
      transaction_reason_id: sql`values(transaction_reason_id)`,
    })
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_transaction_reasons")
    .dropColumn("status")
    .execute()
}
