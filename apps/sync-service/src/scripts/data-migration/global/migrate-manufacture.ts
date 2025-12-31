import { db } from "@/scripts/db.platform.js"
import {
  deleteTableMapping,
  deleteTableMaster,
  getMapGlobalUserIds,
  getMapUserIds,
  insertTableMapping,
} from "@/scripts/helper.js"
import { collect } from "@smile/lib/utils.js"
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

export const migrateManufacture = async (
  limit: number,
  programId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.info(
    `Migration manfucature started at: ${startTime.toLocaleString()}`
  )

  console.info("migration start...")

  const migrationDB = getMigrationDB(programId)

  // Truncate tables if requested
  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting previous Immunization data...")

    const programIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
    await deleteTableMaster("manufactures", programIds)
    await deleteTableMapping("manufactures", programIds)
  }

  let manufactureCount = 0
  let manufactureWorkspaceCount = 0
  try {
    await db.transaction().execute(async (trx) => {
      const rows = await migrationDB
        .selectFrom("manufactures")
        .select(["id", "name", "created_by", "updated_by", "deleted_by"])
        .where("deleted_at", "is", null)
        .orderBy("id")
        .$if(limit > 0, (qb) => qb.limit(limit))
        .execute()
      manufactureCount = rows.length

      const [
        mappedUserGlobalCreatedBy,
        mappedUserGlobalUpdatedBy,
        mappedUserGlobalDeletedBy,
      ] = await Promise.all([
        getMapGlobalUserIds(collect(rows, "created_by")),
        getMapGlobalUserIds(collect(rows, "updated_by")),
        getMapGlobalUserIds(collect(rows, "deleted_by")),
      ])

      console.info(`migrating ${rows.length} manufactures`)

      for (const row of rows) {
        console.info(`migrating manufacture ${row.id}`)

        const manufacture = await migrationDB
          .selectFrom("manufactures")
          .selectAll()
          .where("manufactures.id", "=", row.id)
          .executeTakeFirst()

        if (!manufacture) {
          continue
        }

        const existingManufacture = await trx
          .selectFrom("manufactures")
          .selectAll()
          .where("name", "=", manufacture.name)
          .where("deleted_at", "is", null)
          .executeTakeFirst()
        let globalId = Number(existingManufacture?.id)

        if (!globalId) {
          const insertManufacture = await trx
            .insertInto("manufactures")
            .values({
              name: manufacture.name ?? "",
              address: manufacture.address,
              email: manufacture.email,
              contact_name: manufacture.contact_name,
              description: manufacture.description,
              phone_number: manufacture.phone_number ?? "",
              reference_id: manufacture.reference_id,
              status: manufacture.status,
              type: manufacture.type,
              created_at: manufacture.created_at,
              created_by:
                mappedUserGlobalCreatedBy[manufacture?.created_by ?? -1] ??
                null,
              deleted_at: manufacture.deleted_at,
              deleted_by:
                mappedUserGlobalDeletedBy[manufacture?.deleted_by ?? -1] ??
                null,
              updated_at: manufacture.updated_at,
              updated_by:
                mappedUserGlobalUpdatedBy[manufacture?.updated_by ?? -1] ??
                null,
            })
            .executeTakeFirst()

          globalId = Number(insertManufacture.insertId)
        }
        const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

        for (const progId of platformProgramIds) {
          const existingManufactureWorkspace = await trx
            .selectFrom("manufacture_workspaces")
            .selectAll()
            .where("manufacture_id", "=", globalId)
            .where("workspace_id", "=", progId)
            .executeTakeFirst()
          let wsGlobalId = Number(existingManufactureWorkspace?.id)
          let platformGlobalId = Number(
            existingManufactureWorkspace?.manufacture_id
          )

          if (!existingManufactureWorkspace) {
            const mappedUserProgramUpdatedBy = await getMapUserIds(
              progId,
              collect(rows, "updated_by")
            )

            const res = await trx
              .insertInto("manufacture_workspaces")
              .values({
                manufacture_id: globalId,
                workspace_id: progId,
                updated_by:
                  mappedUserProgramUpdatedBy[manufacture?.updated_by ?? -1] ??
                  null,
              })
              .executeTakeFirst()
            wsGlobalId = Number(res.insertId)
            platformGlobalId = Number(globalId)
          }
          manufactureWorkspaceCount++

          await insertTableMapping(
            "manufactures",
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
    })

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration manufacture finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - Manufactures: ${manufactureCount} records`)
    console.info(
      `   - Manufacture Workspaces: ${manufactureWorkspaceCount} records`
    )
    console.info("✅ All global manufacture migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("migration failed")
    console.error(error)
    process.exit(1)
  }
}
