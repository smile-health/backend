import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_transactions_return_histories")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("consumption_transaction_id", "bigint", (col) => col.notNull())
    .addColumn("return_transaction_id", "bigint", (col) => col.notNull())
    .addColumn("return_qty", "double precision", (col) => col.notNull())
    .addColumn("returned_qty_open_vial", "double precision", (col) =>
      col.defaultTo(0)
    )
    .addColumn("qty_in_vial", "double precision", (col) => col.defaultTo(0))
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("ws_trh_consumption_transaction_id_index")
    .on("ws_transactions_return_histories")
    .column("consumption_transaction_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_transactions_return_histories").execute()
}
