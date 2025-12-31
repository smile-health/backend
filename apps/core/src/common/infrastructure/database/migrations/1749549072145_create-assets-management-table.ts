import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("asset_vendor_types")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  await db.schema
    .createTable("asset_vendors")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("asset_vendor_type_id", "bigint", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  await db.schema
    .createTable("asset_vendor_workspaces")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("asset_vendor_id", "bigint", (col) => col.notNull())
    .addColumn("workspace_id", "bigint", (col) => col.notNull())
    .addColumn("status", "boolean", (col) => col.defaultTo(true))
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  await db.schema
    .createTable("asset_types")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("min_temperature", "double precision")
    .addColumn("max_temperature", "double precision")
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  await db.schema
    .createTable("asset_type_workspaces")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("asset_type_id", "bigint", (col) => col.notNull())
    .addColumn("workspace_id", "bigint", (col) => col.notNull())
    .addColumn("status", "boolean", (col) => col.defaultTo(true))
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  await db.schema
    .createTable("asset_models")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("asset_type_id", "bigint", (col) => col.notNull())
    .addColumn("manufacture_id", "bigint", (col) => col.notNull())
    .addColumn("net_capacity", "double precision")
    .addColumn("gross_capacity", "double precision")
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  await db.schema
    .createTable("asset_model_workspaces")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("asset_model_id", "bigint", (col) => col.notNull())
    .addColumn("workspace_id", "bigint", (col) => col.notNull())
    .addColumn("status", "boolean", (col) => col.defaultTo(true))
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("asset_vendor_types").execute()
  await db.schema.dropTable("asset_vendors").execute()
  await db.schema.dropTable("asset_vendor_workspaces").execute()
  await db.schema.dropTable("asset_types").execute()
  await db.schema.dropTable("asset_type_workspaces").execute()
  await db.schema.dropTable("asset_models").execute()
  await db.schema.dropTable("asset_model_workspaces").execute()
}
