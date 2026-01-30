/* eslint-disable @typescript-eslint/no-explicit-any */
import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { getMigrationDB } from "@/scripts/db.migration.js"
import { db } from "@/scripts/db.platform.js"
import {
  deleteTableMapping,
  deleteTableMaster,
  getMapEntityIds,
  partition,
} from "@/scripts/helper.js"
import { DB } from "@/scripts/types.platform.js"
import { associateField, collect } from "@smile-health/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { randomUUID } from "node:crypto"
import { MigrationDB } from "../../types.js"
import { MAP_EXISTING_TO_PLATFORM } from "../const.js"
import { IMMUNIZATION } from "../constants/program.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateUsers = async (
  batchSize: number,
  programId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.info(`Migration users started at: ${startTime.toLocaleString()}`)
  console.info("migration start...")
  const migrationDB = getMigrationDB(programId)

  // Truncate tables if requested
  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting previous Immunization data...")

    const programIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
    await deleteTableMaster("users", programIds)
    await deleteTableMapping("users", programIds)
  }

  let userCount = 0
  let userWorkspaceCount = 0
  let page = 0
  try {
    while (true) {
      const rows = await migrationDB
        .selectFrom("users as e")
        .select(["e.id"])
        .orderBy("e.id")
        .where("deleted_at", "is", null)
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const userIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        const counts = await doMigrateUsers(
          migrationDB,
          trx,
          userIds,
          programId
        )
        userCount += counts.userCount
        userWorkspaceCount += counts.userWorkspaceCount
      })

      page++
      console.log(`batch ${page} is finished`)
    }

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration users finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - Users: ${userCount} records`)
    console.info(`   - User Workspaces: ${userWorkspaceCount} records`)
    console.info("✅ All global user migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("migration failed")
    console.error(error)
    process.exit(1)
  }
}

export const resetMigrateUser = async () => {}

export const doMigrateUsers = async (
  migrationDB: Kysely<MigrationDB>,
  trx: Transaction<DB>,
  userIds: number[],
  programId: number
) => {
  const rows = await migrationDB
    .selectFrom("users")
    .selectAll("users")
    .where("users.id", "in", userIds)
    .execute()

  const usernames = collect(rows, "username")
  const platformUsers = await db
    .selectFrom("users as u")
    .select(["u.id", "u.username"])
    .where("u.username", "in", usernames)
    .execute()

  const mapWsEntityIds = await getMapEntityIds(
    programId,
    collect(rows, "entity_id")
  )
  const wsEntities = await trx
    .selectFrom("entity_workspaces as ew")
    .where("id", "in", Object.values(mapWsEntityIds).map(Number))
    .select(["ew.id", "ew.entity_id"])
    .execute()
  const mapEntityIds = associateField(wsEntities, "id", "entity_id")

  // separate existing and new entities
  const [existingUsers, users] = partition(rows, (row) =>
    platformUsers.some(
      (e) => e.username?.toLowerCase() === row.username?.toLowerCase()
    )
  )
  let insertedIds: number[] = []

  insertedIds = await createPlatformUser(
    trx,
    programId,
    users,
    mapEntityIds,
    mapWsEntityIds
  )

  const wsRows: any = []
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

  for (const [i, user] of users.entries()) {
    wsRowPlatformUserProgram(
      programId,
      user,
      wsRows,
      insertedIds,
      platformProgramIds,
      i
    )
  }

  for (const user of existingUsers) {
    const platformUser = platformUsers.find(
      (u) => user.username?.toLowerCase() === u.username?.toLowerCase()
    )
    if (!platformUser) continue
    wsRowExistingUserProgram(
      programId,
      user,
      wsRows,
      platformUser,
      platformProgramIds
    )
  }

  if (wsRows.length === 0) {
    console.log("No rows to insert")
    return { userCount: rows.length, userWorkspaceCount: 0 }
  }
  const insertedWsIds = await trx
    .insertInto("user_workspaces")
    .values(
      wsRows.map((row) => ({
        user_id: row.user_id,
        workspace_id: row.workspace_id,
        status: row.status,
      }))
    )
    .executeTakeFirst()

  if (insertedWsIds.insertId) {
    await syncDB
      .insertInto("mapping_users")
      .values(
        wsRows.map((row, i) => ({
          program_id: row.workspace_id,
          platform_user_id: insertedWsIds.insertId! + BigInt(i),
          platform_global_id: row.user_id,
          existing_user_id: row.existing_user_id,
        }))
      )
      .execute()
  }

  return { userCount: rows.length, userWorkspaceCount: wsRows.length }
}

async function createPlatformUser(
  trx: Transaction<DB>,
  programId: number,
  users: any,
  mapEntityIds: any,
  mapWsEntityIds: any
) {
  let insertedIds: number[] = []
  if (users.length > 0) {
    const res = await trx
      .insertInto("users")
      .values(
        users.map((user) => ({
          username: user.username ?? "",
          email: user.email ?? "",
          firstname: user.firstname ?? "",
          lastname: user.lastname ?? "",
          date_of_birth: user.date_of_birth,
          gender: user.gender,
          mobile_phone: user.mobile_phone ?? "",
          address: user.address ?? "",
          created_at: user.created_at ?? new Date(),
          updated_at: user.updated_at ?? new Date(),
          password: user.password ?? "",
          entity_id: mapEntityIds[mapWsEntityIds[user.entity_id ?? 0] ?? 0],
          role: user.role,
          village_id: user.village_id,
          timezone_id: user.timezone_id,
          status: user.status,
          last_login: user.last_login,
          mobile_phone_2: user.mobile_phone_2,
          mobile_phone_brand: user.mobile_phone_brand,
          mobile_phone_model: user.mobile_phone_model,
          imei_number: user.imei_number,
          sim_provider: user.sim_provider,
          sim_id: user.sim_id,
          iota_app_gui_theme: user.iota_app_gui_theme,
          permission: user.permission,
          application_version: user.application_version,
          view_only: user.view_only,
          manufacture_id: user.manufacture_id,
          fcm_token: user.fcm_token,
          user_uuid: randomUUID(),
        }))
      )
      .executeTakeFirst()

    insertedIds = Array.from(
      { length: users.length },
      (_, i) => Number(res.insertId) + i
    )
  }

  return insertedIds
}

function wsRowPlatformUserProgram(
  programId: number,
  user: any,
  wsRows: any,
  insertedIds: number[],
  platformProgramIds: number[],
  i: number
) {
  if (programId === 1) {
    if (user.email?.includes("_rab"))
      wsRows.push({
        existing_user_id: user.id,
        user_id: insertedIds[i],
        status: user.status,
        workspace_id: 6,
      })
    else
      platformProgramIds.forEach((id) => {
        wsRows.push({
          existing_user_id: user.id,
          user_id: insertedIds[i],
          status: user.status,
          workspace_id: id,
        })
      })
  } else if (programId === 2) {
    if (user.email?.includes("_mal"))
      wsRows.push({
        existing_user_id: user.id,
        user_id: insertedIds[i],
        status: user.status,
        workspace_id: 3,
      })
    else if (user.email?.includes("_tb"))
      wsRows.push({
        existing_user_id: user.id,
        user_id: insertedIds[i],
        status: user.status,
        workspace_id: 4,
      })
    else if (user.email?.includes("_hiv"))
      wsRows.push({
        existing_user_id: user.id,
        user_id: insertedIds[i],
        status: user.status,
        workspace_id: 5,
      })
    else
      platformProgramIds.forEach((id) => {
        wsRows.push({
          existing_user_id: user.id,
          user_id: insertedIds[i],
          status: user.status,
          workspace_id: id,
        })
      })
  }
}

function wsRowExistingUserProgram(
  programId: number,
  user: any,
  wsRows: any,
  platformUser: any,
  platformProgramIds: number[]
) {
  if (programId === 1) {
    if (user.email?.includes("_rab"))
      wsRows.push({
        existing_user_id: user.id,
        user_id: platformUser.id,
        status: user.status,
        workspace_id: 6,
      })
    else
      platformProgramIds.forEach((id) => {
        wsRows.push({
          existing_user_id: user.id,
          user_id: platformUser.id,
          status: user.status,
          workspace_id: id,
        })
      })
  } else if (programId === 2) {
    if (user.email?.includes("_mal"))
      wsRows.push({
        existing_user_id: user.id,
        user_id: platformUser.id,
        status: user.status,
        workspace_id: 3,
      })
    else if (user.email?.includes("_tb"))
      wsRows.push({
        existing_user_id: user.id,
        user_id: platformUser.id,
        status: user.status,
        workspace_id: 4,
      })
    else if (user.email?.includes("_hiv"))
      wsRows.push({
        existing_user_id: user.id,
        user_id: platformUser.id,
        status: user.status,
        workspace_id: 5,
      })
    else
      platformProgramIds.forEach((id) => {
        wsRows.push({
          existing_user_id: user.id,
          user_id: platformUser.id,
          status: user.status,
          workspace_id: id,
        })
      })
  }
}
