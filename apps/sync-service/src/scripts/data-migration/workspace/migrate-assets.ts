import { Transaction } from "kysely"
import { db } from "../../db.platform.js"
import { DB } from "../../types.platform.js"
import {
  assetCalibrationSchedulesData,
  assetElectricitiesData,
  assetMaintenanceSchedulesData,
  assetWorkingStatusesData,
} from "../constants/asset-schedules.js"
import { MAP_EXISTING_TO_PLATFORM } from "../const.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

const insertAssetCalibrationSchedules = async (
  trx: Transaction<DB>,
  programId: number
) => {
  const workspaceId = MAP_EXISTING_TO_PLATFORM[programId]?.[0] ?? programId

  console.info(
    `Inserting ${assetCalibrationSchedulesData.length} asset calibration schedules for workspace ${workspaceId}`
  )

  const result = await trx
    .insertInto("ws_asset_calibration_schedules")
    .values(
      assetCalibrationSchedulesData.map((schedule) => ({
        name: schedule.name,
        created_at: new Date(schedule.created_at),
        updated_at: new Date(schedule.updated_at),
      }))
    )
    .execute()

  return result.length
}

const insertAssetElectricities = async (
  trx: Transaction<DB>,
  programId: number
) => {
  const workspaceId = MAP_EXISTING_TO_PLATFORM[programId]?.[0] ?? programId

  console.info(
    `Inserting ${assetElectricitiesData.length} asset electricities for workspace ${workspaceId}`
  )

  const result = await trx
    .insertInto("ws_asset_electricities")
    .values(
      assetElectricitiesData.map((electricity) => ({
        name: electricity.name,
        created_at: new Date(electricity.created_at),
        updated_at: new Date(electricity.updated_at),
      }))
    )
    .execute()

  return result.length
}

const insertAssetMaintenanceSchedules = async (
  trx: Transaction<DB>,
  programId: number
) => {
  const workspaceId = MAP_EXISTING_TO_PLATFORM[programId]?.[0] ?? programId

  console.info(
    `Inserting ${assetMaintenanceSchedulesData.length} asset maintenance schedules for workspace ${workspaceId}`
  )

  const result = await trx
    .insertInto("ws_asset_maintenance_schedules")
    .values(
      assetMaintenanceSchedulesData.map((schedule) => ({
        name: schedule.name,
        created_at: new Date(schedule.created_at),
        updated_at: new Date(schedule.updated_at),
      }))
    )
    .execute()

  return result.length
}

const insertAssetWorkingStatuses = async (
  trx: Transaction<DB>,
  programId: number
) => {
  const workspaceId = MAP_EXISTING_TO_PLATFORM[programId]?.[0] ?? programId

  console.info(
    `Inserting ${assetWorkingStatusesData.length} asset working statuses for workspace ${workspaceId}`
  )

  const result = await trx
    .insertInto("ws_asset_working_statuses")
    .values(
      assetWorkingStatusesData.map((status) => ({
        name: status.name,
        created_at: new Date(status.created_at),
        updated_at: new Date(status.updated_at),
      }))
    )
    .execute()

  return result.length
}

export const migrateWsAssets = async (programId = 1) => {
  const startTime = new Date()
  console.info(
    `Migration workspace assets started at: ${startTime.toLocaleString()}`
  )
  console.info("migration start...")

  let calibrationScheduleCount = 0
  let electricityCount = 0
  let maintenanceScheduleCount = 0
  let workingStatusCount = 0

  try {
    await db.transaction().execute(async (trx) => {
      // Insert asset calibration schedules
      calibrationScheduleCount = await insertAssetCalibrationSchedules(
        trx,
        programId
      )

      // Insert asset electricities
      electricityCount = await insertAssetElectricities(trx, programId)

      // Insert asset maintenance schedules
      maintenanceScheduleCount = await insertAssetMaintenanceSchedules(
        trx,
        programId
      )

      // Insert asset working statuses
      workingStatusCount = await insertAssetWorkingStatuses(trx, programId)
    })

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration workspace assets finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(
      `   - Asset Calibration Schedules: ${calibrationScheduleCount} records`
    )
    console.info(`   - Asset Electricities: ${electricityCount} records`)
    console.info(
      `   - Asset Maintenance Schedules: ${maintenanceScheduleCount} records`
    )
    console.info(`   - Asset Working Statuses: ${workingStatusCount} records`)
    console.info("✅ All workspace assets migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("❌ Workspace assets migration failed:", error)
    throw error
  }
}
