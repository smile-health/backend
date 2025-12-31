import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import { getMapEntityIds, resetIncrement } from "../../helper.js"
import { MigrationDB } from "../../types.js"
import { DB } from "../../types.platform.js"

import { MAP_EXISTING_TO_PLATFORM } from "../const.js"
import { IMMUNIZATION } from "../constants/program.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateEntityPrepMinMax = async (
  batchSize: number,
  existingProgramId = 1,
  truncate: boolean = false
) => {
  const startTime = new Date()
  console.log(
    `Migration entityPrepMinMax started at: ${startTime.toLocaleString()}`
  )

  if (truncate && existingProgramId === IMMUNIZATION) {
    console.log("Truncating immunization entityPrepMinMax tables...")
    await deleteEntityPrepMinMaxRelations(existingProgramId)
  }

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[existingProgramId] ?? []
  const migrationDB = getMigrationDB(existingProgramId)

  for (const platformProgramId of platformProgramIds) {
    console.log(
      `Migrating entityPrepMinMax for existing program ID ${existingProgramId} to platform program ID ${platformProgramId}`
    )

    let page = 0
    let totalProcessed = 0
    while (true) {
      try {
        const rows = await migrationDB
          .selectFrom("entity_prep_min_max as e")
          .select(["e.entity_id"])
          .where("e.entity_id", "is not", null)
          .orderBy("e.entity_id")
          .limit(batchSize)
          .offset(page * batchSize)
          .execute()

        if (rows.length === 0) {
          break
        }

        const entityIds = collect(rows, "entity_id").filter(
          (id): id is number => id !== null
        )

        if (entityIds.length > 0) {
          await db.transaction().execute(async (trx) => {
            await doMigrate(
              trx,
              migrationDB,
              existingProgramId,
              platformProgramId,
              entityIds
            )
          })
        }

        totalProcessed += rows.length
        page++
        console.log(
          `Processed batch ${page} with ${rows.length} records (Total: ${totalProcessed})`
        )
      } catch (error) {
        console.error(`Error processing batch ${page + 1}:`, error)
        throw error
      }
    }

    console.log(
      `Completed migration for program ${platformProgramId}. Total records processed: ${totalProcessed}`
    )
  }

  const endTime = new Date()
  console.log(
    `Migration entityPrepMinMax completed at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  process.exit(0)
}

async function doMigrate(
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  existingProgramId: number,
  platformProgramId: number,
  entityIds: number[]
) {
  try {
    // Get all entity_prep_min_max data for the batch
    const entityPrepMinMaxData = await migrationDB
      .selectFrom("entity_prep_min_max as e")
      .select([
        "e.entity_id",
        "e.distribution_time",
        "e.lead_time",
        "e.created_at",
        "e.updated_at",
      ])
      .where("e.entity_id", "in", entityIds)
      .where("e.entity_id", "is not", null)
      .execute()

    if (entityPrepMinMaxData.length === 0) {
      console.log(
        `No entity_prep_min_max data found for entity IDs: ${entityIds.join(", ")}`
      )
      return
    }

    console.log(
      `Processing ${entityPrepMinMaxData.length} entity_prep_min_max records`
    )

    // Get entity ID mappings
    const mapEntityIds = await getMapEntityIds(
      platformProgramId,
      collect(entityPrepMinMaxData, "entity_id").filter(
        (id): id is number => id !== null
      )
    )

    // Prepare data for insertion
    const insertData = entityPrepMinMaxData
      .map((item) => {
        // Handle null entity_id case
        if (item.entity_id === null) {
          console.warn("Skipping record with null entity_id")
          return null
        }

        const mappedEntityId = mapEntityIds[item.entity_id]

        if (!mappedEntityId) {
          console.warn(
            `No entity mapping found for entity_id: ${item.entity_id}`
          )
          return null
        }

        return {
          program_id: platformProgramId,
          entity_id: mappedEntityId,
          distribution_time: item.distribution_time,
          lead_time: item.lead_time,
          ...(item.created_at && { created_at: item.created_at }),
          ...(item.updated_at && { updated_at: item.updated_at }),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    if (insertData.length === 0) {
      console.log("No valid data to insert after entity mapping")
      return
    }

    // Insert into platform database
    await trx.insertInto("entity_prep_min_max").values(insertData).execute()

    console.log(
      `Successfully migrated ${insertData.length} entity_prep_min_max records`
    )
  } catch (error) {
    console.error("Error in doMigrate:", error)
    throw error
  }
}

export const deleteEntityPrepMinMaxRelations = async (programId = IMMUNIZATION) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  await db
    .deleteFrom("entity_prep_min_max")
    .where("program_id", "in", platformProgramIds)
    .execute()

  // Reset auto increment for deleted tables
  await resetIncrement(db, "entity_prep_min_max")
}
