import { db } from "@/scripts/db.platform.js"
import {
  deleteTableMapping,
  deleteTableMaster,
  insertTableMapping,
} from "@/scripts/helper.js"
import { getMigrationDB } from "../../db.migration.js"
import { MAP_EXISTING_TO_PLATFORM } from "../const.js"
import { IMMUNIZATION } from "../constants/program.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateBudgetSource = async (
  limit: number,
  programId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.info(
    `Migration budget source started at: ${startTime.toLocaleString()}`
  )

  console.info("migration start...")

  const migrationDB = getMigrationDB(programId)

  // Truncate tables if requested
  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting previous Immunization data...")

    const programIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
    await deleteTableMaster("budget_sources", programIds)
    await deleteTableMapping("budget_sources", programIds)
  }

  let budgetSourceCount = 0
  let budgetSourceWorkspaceCount = 0
  try {
    const rows = await migrationDB
      .selectFrom("source_materials")
      .select("id")
      .orderBy("id")
      .$if(limit > 0, (qb) => qb.limit(limit))
      .execute()
    budgetSourceCount = rows.length

    console.info(`migrating ${budgetSourceCount} budget sources`)

    for (const row of rows) {
      console.info(`migrating budget source ${row.id}`)

      const sourceAsset = await migrationDB
        .selectFrom("source_materials")
        .selectAll()
        .where("source_materials.id", "=", row.id)
        .executeTakeFirst()
      if (!sourceAsset) {
        continue
      }

      const existingBudgetSource = await db
        .selectFrom("budget_sources")
        .selectAll()
        .where("budget_sources.name", "=", sourceAsset.name)
        .where("deleted_at", "is", null)
        .executeTakeFirst()
      let globalID = existingBudgetSource?.id

      if (!globalID) {
        const insertData = await db
          .insertInto("budget_sources")
          .values({
            name: sourceAsset?.name ?? "",
            deleted_at: sourceAsset?.deleted_at,
            created_at: sourceAsset?.created_at,
            updated_at: sourceAsset?.updated_at ?? new Date(),
          })
          .executeTakeFirst()
        globalID = Number(insertData.insertId)
      }

      const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

      for (const progId of platformProgramIds) {
        const existingBudgetSourceWorkspace = await db
          .selectFrom("budget_source_workspaces")
          .selectAll()
          .where("budget_source_workspaces.budget_source_id", "=", globalID)
          .where("budget_source_workspaces.workspace_id", "=", progId)
          .executeTakeFirst()
        let wsGlobalId = existingBudgetSourceWorkspace?.id
        let platformGlobalId = Number(
          existingBudgetSourceWorkspace?.budget_source_id
        )

        if (!existingBudgetSourceWorkspace) {
          const res = await db
            .insertInto("budget_source_workspaces")
            .values({
              budget_source_id: globalID,
              workspace_id: progId,
              status: sourceAsset.deleted_at ? 0 : 1,
            })
            .executeTakeFirst()
          wsGlobalId = Number(res.insertId)
          platformGlobalId = Number(globalID)
        }

        budgetSourceWorkspaceCount++

        await insertTableMapping(
          "budget_sources",
          progId,
          {
            [row.id]: wsGlobalId,
          },
          {
            [row.id]: platformGlobalId,
          }
        )
      }
    }

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration budget source finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - Budget Sources: ${budgetSourceCount} records`)
    console.info(
      `   - Budget Source Workspaces: ${budgetSourceWorkspaceCount} records`
    )
    console.info("✅ All global budget source migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("migration failed")
    console.error(error)
    process.exit(1)
  }
}
