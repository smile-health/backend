import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_transactions")
    .addColumn("returned_qty", "double precision", (col) => col.defaultTo(0))
    .addColumn("returnable", "boolean", (col) => col.defaultTo(false))
    .addColumn("returned_qty_open_vial", "double precision", (col) =>
      col.defaultTo(0)
    )
    .addColumn("change_qty_open_vial", "double precision", (col) =>
      col.defaultTo(0)
    )
    .addColumn("qty_in_vial", "double precision", (col) => col.defaultTo(0))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_transactions")
    .dropColumn("returned_qty")
    .dropColumn("returnable")
    .dropColumn("returned_qty_open_vial")
    .dropColumn("change_qty_open_vial")
    .dropColumn("qty_in_vial")
    .execute()
}
