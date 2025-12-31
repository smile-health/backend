import { type Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const EXPORT_LOGS = [
    {
      export_category_id: 1,
      program_id: 2,
      code: "56",
    },
    {
      export_category_id: 1,
      program_id: 2,
      code: "57",
    },
    {
      export_category_id: 1,
      program_id: 2,
      code: "58",
    },
    {
      export_category_id: 2,
      program_id: 2,
      code: "43",
    },
    {
      export_category_id: 2,
      program_id: 2,
      code: "44",
    },
    {
      export_category_id: 2,
      program_id: 2,
      code: "45",
    },
    {
      export_category_id: 3,
      program_id: 2,
      code: "46",
    },
    {
      export_category_id: 3,
      program_id: 2,
      code: "47",
    },
    {
      export_category_id: 3,
      program_id: 2,
      code: "48",
    },
    {
      export_category_id: 5,
      program_id: 2,
      code: "49",
    },
  ]

  await db.schema
    .createTable("export_logs")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("export_category_id", "bigint", (col) => col.notNull())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("code", "varchar(255)", (col) => col.notNull())
    .addColumn("month", "smallint")
    .addColumn("year", "smallint")
    .$call(addTimestampColumns)
    .execute()
  await db.insertInto("export_logs").values(EXPORT_LOGS).execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("export_logs").execute()
}
