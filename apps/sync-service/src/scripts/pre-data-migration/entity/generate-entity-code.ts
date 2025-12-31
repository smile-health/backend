import { IMMUNIZATION } from "@/scripts/data-migration/constants/program.js"
import { getMigrationDB } from "@/scripts/db.migration.js"
import { db } from "@/scripts/db.platform.js"
import {
  entityAnomalyNames,
  entityCodes,
} from "@/scripts/pre-data-migration/constants/entity-codes.js"
import { sql } from "kysely"

export async function generateEntityCode(programId = IMMUNIZATION) {
  const migrationDB = getMigrationDB(programId)
  console.log("Starting generateEntityCode script...")

  try {
    // 1. Update entity codes on migrationDB with entityCodes
    console.log("Updating entity codes from entityCodes constant...")
    for (const { id, code } of entityCodes) {
      await migrationDB
        .updateTable("entities")
        .set({ code })
        .where("id", "=", id)
        .execute()
    }
    console.log("Finished updating entity codes from entityCodes constant.")

    // 2. Update entity code with entityAnomalyNames
    if (entityAnomalyNames.length > 0) {
      console.log("Updating entity codes for anomaly names...")
      const caseSql = sql.join(
        entityAnomalyNames.map(
          (name) => sql`WHEN name LIKE ${"%" + name} THEN ${name}`
        ),
        sql.raw("\n")
      )

      await Promise.all([
        migrationDB
          .updateTable("entities")
          .set({
            code: sql`CASE ${caseSql} END`,
          })
          .where((eb) =>
            eb.or(
              entityAnomalyNames.map((name) => eb("name", "like", `%${name}%`))
            )
          )
          .execute(),
        db
          .updateTable("entities")
          .set({
            code: sql`CASE ${caseSql} END`,
          })
          .where((eb) =>
            eb.or(
              entityAnomalyNames.map((name) => eb("name", "like", `%${name}%`))
            )
          )
          .execute(),
      ])
      console.log("Finished updating entity codes for anomaly names.")
    }

    // 3. Update the rest of the codes with name-province_id-regency_id pattern
    console.log("Updating remaining entity codes...")
    await Promise.all([
      migrationDB
        .updateTable("entities")
        .set({
          code: sql`concat_ws('-', name, province_id, regency_id)`,
        })
        .where("code", "is", null)
        .where("deleted_at", "is", null)
        .execute(),
      db
        .updateTable("entities")
        .set({
          code: sql`concat_ws('-', name, province_id, regency_id)`,
        })
        .where("code", "is", null)
        .where("deleted_at", "is", null)
        .execute(),
    ])
    console.log("Finished updating remaining entity codes.")
  } catch (error) {
    console.error("Error in generateEntityCode script:", error)
  }
}
