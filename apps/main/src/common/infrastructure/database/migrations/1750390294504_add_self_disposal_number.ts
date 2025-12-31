import type { Kysely } from "kysely"

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("ws_disposal_transactions")
    .addColumn("report_number", "varchar(255)")
    .addColumn("comment", "text")
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("ws_disposal_transactions")
    .dropColumn("report_number")
    .dropColumn("comment")
    .execute()
}
