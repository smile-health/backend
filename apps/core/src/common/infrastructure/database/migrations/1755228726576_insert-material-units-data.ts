import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // Remove unique index on name column to allow duplicate names with different types
  await sql`
    ALTER TABLE material_units DROP INDEX name
  `.execute(db)

  const materialUnits = [
    { id: 1, name: "pcs", type: "consumption" },
    { id: 2, name: "doses", type: "consumption" },
    { id: 3, name: "ml", type: "consumption" },
    { id: 4, name: "tablet", type: "consumption" },
    { id: 5, name: "gram", type: "consumption" },
    { id: 6, name: "box", type: "distribution" },
    { id: 7, name: "vial", type: "distribution" },
    { id: 8, name: "wrap", type: "distribution" },
    { id: 9, name: "pack", type: "distribution" },
    { id: 10, name: "cc", type: "consumption" },
    { id: 11, name: "ampul", type: "consumption" },
    { id: 12, name: "vial", type: "consumption" },
    { id: 13, name: "kapsul", type: "consumption" },
    { id: 14, name: "botol", type: "consumption" },
    { id: 15, name: "unit", type: "consumption" },
    { id: 16, name: "pack", type: "consumption" },
    { id: 17, name: "tube", type: "consumption" },
    { id: 18, name: "kit", type: "consumption" },
    { id: 19, name: "sachet", type: "consumption" },
    { id: 20, name: "jerigen", type: "consumption" },
    { id: 21, name: "test", type: "consumption" },
    { id: 22, name: "pasang", type: "consumption" },
    { id: 23, name: "strip", type: "consumption" },
    { id: 24, name: "set", type: "consumption" },
  ]

  // Insert or update material units using onDuplicateKeyUpdate
  await db
    .insertInto("material_units")
    .values(materialUnits)
    .onDuplicateKeyUpdate({
      name: sql`VALUES(name)`,
      type: sql`VALUES(type)`,
      updated_at: sql`NOW()`,
    })
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Delete the specific material units that were inserted
  const materialUnitIds = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23, 24,
  ]

  await db
    .deleteFrom("material_units")
    .where("id", "in", materialUnitIds)
    .execute()

  // Recreate unique index on name column
  await sql`
    ALTER TABLE material_units ADD UNIQUE INDEX name (name)
  `.execute(db)
}
