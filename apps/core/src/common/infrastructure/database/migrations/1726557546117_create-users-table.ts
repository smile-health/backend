import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("username", "varchar(255)")
    .addColumn("password", "varchar(255)")
    .addColumn("email", "varchar(255)")
    .addColumn("firstname", "varchar(255)")
    .addColumn("lastname", "varchar(255)")
    .addColumn("date_of_birth", "date")
    .addColumn("gender", "int4")
    .addColumn("mobile_phone", "varchar(255)")
    .addColumn("address", "text")
    .addColumn("role", "int4")
    .addColumn("village_id", "varchar(255)")
    .addColumn("entity_id", "int4")
    .addColumn("timezone_id", "int4")
    .addColumn("token_login", "text")
    .addColumn("status", "smallint")
    .addColumn("last_login", "date")
    .addColumn("last_device", "smallint")
    .addColumn("mobile_phone_2", "varchar(255)")
    .addColumn("mobile_phone_brand", "varchar(255)")
    .addColumn("mobile_phone_model", "varchar(255)")
    .addColumn("imei_number", "varchar(255)")
    .addColumn("sim_provider", "varchar(255)")
    .addColumn("sim_id", "varchar(255)")
    .addColumn("iota_app_gui_theme", "varchar(255)")
    .addColumn("permission", "varchar(255)")
    .addColumn("application_version", "varchar(255)")
    .addColumn("last_mobile_access", "datetime")
    .addColumn("view_only", "int4", (col) => col.notNull().defaultTo(0))
    .addColumn("change_password", "smallint")
    .addColumn("manufacture_id", "int4")
    .addColumn("fcm_token", "varchar(255)")
    .addColumn("created_by", "int4")
    .addColumn("updated_by", "int4")
    .addColumn("deleted_by", "int4")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col
        .defaultTo(sql`CURRENT_TIMESTAMP `)
        .notNull()
        .modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP`)
    )
    .addColumn("keycloak_uuid", "varchar(50)")
    .addColumn("user_uuid", "varchar(50)")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("users").execute()
}
