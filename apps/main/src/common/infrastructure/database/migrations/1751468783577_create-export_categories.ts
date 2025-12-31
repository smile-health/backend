import { type Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("export_categories")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("title", "varchar(255)", (col) => col.defaultTo(null))
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_export_categories")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("export_category_id", "bigint", (col) => col.notNull())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  const EXPORT_CATEGORIES = [
    {
      id: 1,
      title: "reception",
    },
    {
      id: 2,
      title: "stock_material",
    },
    {
      id: 3,
      title: "consumption",
    },
    {
      id: 4,
      title: "expired_material",
    },
    {
      id: 5,
      title: "discard",
    },
    {
      id: 6,
      title: "stock_availability",
    },
    {
      id: 7,
      title: "monitoring_temperature",
    },
  ]

  await db.insertInto("export_categories").values(EXPORT_CATEGORIES).execute()
  // insert into ws_export_categories
  const exportCategoryProgramNonHierarchy = [1, 2, 3, 4, 5, 6, 7]
  const exportCategoryProgramHierarchy = [1, 2, 3, 4, 5]
  const programs = await db.selectFrom("workspaces").selectAll().execute()
  for (const program of programs) {
    const exportCategories = program.config?.material?.is_hierarchy_enabled
      ? exportCategoryProgramHierarchy
      : exportCategoryProgramNonHierarchy
    const exportCategoriesSave = exportCategories.map((id) => ({
      export_category_id: id,
      program_id: program.id,
    }))
    await db
      .insertInto("ws_export_categories")
      .values(exportCategoriesSave)
      .execute()
  }
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("export_categories").execute()
  await db.schema.dropTable("ws_export_categories").execute()
}
