import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_coverage")
    .renameColumn("amount_of_giving_id", "plan_task_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_coverage")
    .renameColumn("plan_task_id", "amount_of_giving_id")
    .execute()
}
