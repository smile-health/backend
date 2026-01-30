import { collect } from "@smile-health/lib/utils.js"
import { Kysely, Transaction, sql } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import {
  deleteTableMapping,
  getMapEntityIds,
  insertTableMapping,
} from "../../helper.js"
import { MigrationDB } from "../../types.js"
import { DB } from "../../types.platform.js"
import { IMMUNIZATION } from "../constants/program.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migratePatients = async (
  batchSize: number,
  programId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.info(`Migration patients started at: ${startTime.toLocaleString()}`)
  console.info("migration start...")

  if (truncate && programId === IMMUNIZATION) {
    await deletePatientRelations(programId)
  }

  const migrationDB = getMigrationDB(programId)

  let patientCount = 0
  let patientWorkspaceCount = 0
  let page = 0
  try {
    while (true) {
      const rows = await migrationDB
        .selectFrom("patients as p")
        .select(["p.id"])
        .where("p.deleted_at", "is", null)
        .orderBy("p.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const patientIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        const counts = await doMigratePatients(
          trx,
          migrationDB,
          programId,
          patientIds
        )
        patientCount += counts.patientCount
        patientWorkspaceCount += counts.patientWorkspaceCount
      })

      page++
      console.log(`batch ${page} is finished`)
    }

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration patients finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - Patients: ${patientCount} records`)
    console.info(`   - Patient Workspaces: ${patientWorkspaceCount} records`)
    console.info("✅ All workspace patient migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("migration failed")
    console.error(error)
    process.exit(1)
  }
}

export const doMigratePatients = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  patientIds: number[]
) => {
  const patients = await migrationDB
    .selectFrom("patients as p")
    .select([
      "p.id",
      "p.entity_id",
      "p.nik",
      "p.vaccine_sequence",
      "p.last_vaccine_at",
      "p.identity_type",
      "p.preexposure_sequence",
      "p.last_preexposure_at",
      "p.stop_notification",
      "p.phone_number",
      "p.vaccine_method",
      "p.created_at",
      "p.updated_at",
      "p.deleted_at",
    ])
    .where("p.id", "in", patientIds)
    .execute()

  const mapEntityIds = await getMapEntityIds(
    programId,
    collect(patients, "entity_id")
  )

  const wsPatients = await trx
    .insertInto("ws_patients")
    .values(
      patients.map((patient) => ({
        nik: patient.nik,
        vaccine_sequence: patient.vaccine_sequence,
        last_vaccine_at: patient.last_vaccine_at,
        created_at: patient.created_at ?? new Date(),
        updated_at: patient.updated_at ?? new Date(),
        deleted_at: patient.deleted_at,
        entity_id: mapEntityIds[patient.entity_id ?? 0],
        identity_type: patient.identity_type,
        preexposure_sequence: patient.preexposure_sequence,
        last_preexposure_at: patient.last_preexposure_at,
        stop_notification: patient.stop_notification,
        phone_number: patient.phone_number,
        vaccine_method: patient.vaccine_method,
      }))
    )
    .onDuplicateKeyUpdate({
      nik: () => sql`CONCAT('dup_', nik)`,
    })
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: patients.length },
    (_, i) => Number(wsPatients.insertId) + i
  )
  const mapLegacyIds = {}
  for (const [i, patient] of patients.entries()) {
    mapLegacyIds[patient.id] = insertedIds[i]
  }

  await insertTableMapping("patients", programId, mapLegacyIds)

  return {
    patientCount: patients.length,
    patientWorkspaceCount: patients.length,
  }
}

export const deletePatientRelations = async (programId = IMMUNIZATION) => {
  // Reset auto increment for deleted tables
  await sql`TRUNCATE TABLE ws_patients`.execute(db)
  await deleteTableMapping("patients", [programId])
}
