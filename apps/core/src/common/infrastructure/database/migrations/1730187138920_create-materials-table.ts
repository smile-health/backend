import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
    .createTable("materials")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("description", "varchar(255)")
    .addColumn("material_level_id", "bigint", (col) => col.references('material_levels.id').onDelete('restrict').notNull())
    .addColumn("code", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("hierarchy_code", "varchar(255)", (col) => col.unique())
    .addColumn("unit_of_consumption_id", "bigint", (col) => col.references('material_units.id').onDelete('restrict').notNull())
    .addColumn("unit_of_distribution_id", "bigint", (col) => col.references('material_units.id').onDelete('restrict').notNull())
    .addColumn("consumption_unit_per_distribution_unit", "integer", (col) => col.notNull())
    .addColumn("is_temperature_sensitive", "boolean", (col) => col.notNull())
    .addColumn("min_retail_price", "double precision", (col) => col.notNull())
    .addColumn("max_retail_price", "double precision", (col) => col.notNull())
    .addColumn("min_temperature", "double precision")
    .addColumn("max_temperature", "double precision")
    .addColumn("material_type_id", "bigint", (col) => col.references('material_types.id').onDelete('restrict').notNull())
    .addColumn("is_managed_in_batch", "boolean", (col) => col.notNull())
    .addColumn("status", "boolean", (col) => col.notNull())
    .addColumn("created_by", "bigint", (col) => col.references('users.id').onDelete('restrict').notNull())
    .addColumn("updated_by", "bigint", (col) => col.references('users.id').onDelete('restrict').notNull())
    .addColumn("deleted_by", "bigint", (col) => col.references('users.id').onDelete('restrict'))
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
    ALTER TABLE materials
    MODIFY deleted_at timestamp NULL
  `

  await db.executeQuery(alterDeletedAtQuery.compile(db))
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("materials").execute()
}
