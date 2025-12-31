import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
    .createTable("material_units")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("type", "varchar(255)", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col
        .defaultTo(sql`CURRENT_TIMESTAMP `)
        .notNull()
        .modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP`)
    )
    .addColumn("deleted_at", "timestamp", (col) => 
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  const alterDeletedAtQuery = sql`
    ALTER TABLE material_units
    MODIFY deleted_at timestamp NULL
  `

  await db.executeQuery(alterDeletedAtQuery.compile(db))
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("material_units").execute()
}
