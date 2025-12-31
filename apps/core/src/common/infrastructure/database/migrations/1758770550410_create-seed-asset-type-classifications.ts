import type { Kysely } from "kysely"
import { sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const classifications = [
    {
      id: 1,
      name: "cce",
      description: "Cold Chain Equipment",
    },
    {
      id: 2,
      name: "logistic",
      description: "Logistic and General",
    },
    {
      id: 3,
      name: "electricity",
      description: "Electricity Logger",
    },
    {
      id: 4,
      name: "selection",
      description: "Selection",
    },
    {
      id: 5,
      name: "warehouse",
      description: "Warehouse",
    },
  ]

  for (const c of classifications) {
    await db
      .insertInto("asset_classifications")
      .values(c)
      .onDuplicateKeyUpdate(() => ({
        name: c.name,
        description: c.description,
      }))
      .execute()
  }
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`TRUNCATE TABLE asset_classifications`.execute(db)
}
