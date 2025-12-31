import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("roles")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col
        .defaultTo(sql`CURRENT_TIMESTAMP `)
        .notNull()
        .modifyEnd(sql`ON UPDATE CURRENT_TIMESTAMP`)
    )
    .execute()

  // Insert initial roles data
  await db
    .insertInto("roles")
    .values([
      { id: 1, name: "Super Admin" },
      { id: 2, name: "Admin" },
      { id: 3, name: "Manager" },
      { id: 4, name: "Operator" },
      { id: 9, name: "Third Party" },
      { id: 11, name: "Vendor IoT" },
      { id: 15, name: "Manufaktur" },
    ])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("roles").execute()
}
