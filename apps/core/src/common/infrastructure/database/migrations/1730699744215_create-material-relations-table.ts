import type { Kysely } from "kysely"
import { sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("material_relations")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("from_material_id", "bigint", (col) => col.references('materials.id').onDelete('restrict').notNull())
    .addColumn("to_material_id", "bigint", (col) => col.references('materials.id').onDelete('restrict').notNull())
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
    .addUniqueConstraint(
      "unique_constraint_from_material_id_to_material_id", 
      ["from_material_id", "to_material_id"]
    )
    .execute()

  const alterDeletedAtQuery = sql`
    ALTER TABLE material_relations
    MODIFY deleted_at timestamp NULL
  `

  await db.executeQuery(alterDeletedAtQuery.compile(db))
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("material_relations").execute()
}
