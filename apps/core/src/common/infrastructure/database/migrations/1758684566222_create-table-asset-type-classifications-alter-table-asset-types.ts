import type { Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addAuditColumns, addTimestampColumns } from "../helper"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("asset_classifications")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("description", "text")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createTable("asset_types_classifications")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("asset_type_id", "bigint", (col) =>
      col.notNull().references("asset_types.id").onDelete("cascade")
    )
    .addColumn("asset_classifications_id", "bigint", (col) =>
      col.notNull().references("asset_classifications.id").onDelete("cascade")
    )
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("asset_classifications").execute()
  await db.schema.dropTable("asset_types_classifications").execute()
}
