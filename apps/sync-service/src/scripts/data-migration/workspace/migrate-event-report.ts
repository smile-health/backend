import { db } from "../../db.platform.js"
import { getMigrationDB } from "../../db.migration.js"
import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction, sql } from "kysely"
import {
  getMapOrderIds,
  getMapEntityIds,
  getMapMaterialIds,
  getMapUserIds,
  insertTableMapping,
  resetIncrement,
} from "../../helper.js"
import { DB } from "../../types.platform.js"
import { MigrationDB } from "../../types.js"

import { MAP_EXISTING_TO_PLATFORM } from "../const.js"
import { IMMUNIZATION } from "../constants/program.js"

// old x new
const newStatusMapping = {
  "1": 1,
  "2": 2,
  "3": 10,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 3,
  "11": 4,
}

//old x new
const newChildReasonMapping = {
  1: 2,
  2: 3,
}

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateEventReport = async (
  batchSize: number,
  existingProgramId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.log(`Migration eventReport started at: ${startTime.toLocaleString()}`)

  if (truncate && existingProgramId === IMMUNIZATION) {
    await deleteEventReportRelations(existingProgramId)
  }

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[existingProgramId] ?? []

  for (const platformProgramId of platformProgramIds) {
    console.log(
      `Migrating eventReport for existing program ID ${existingProgramId} to platform program ID ${platformProgramId}`
    )

    const migrationDB = getMigrationDB(existingProgramId)
    let page = 0
    while (true) {
      const rows = await migrationDB
        .selectFrom("event_reports as e")
        .select(["e.id"])
        .where("e.deleted_at", "is", null)
        .orderBy("e.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const eventIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        await doMigrate(
          trx,
          migrationDB,
          existingProgramId,
          platformProgramId,
          eventIds
        )
      })

      page++
      console.log(`Processed batch ${page} with ${rows.length} records`)
    }
  }

  const endTime = new Date()
  console.log(`Migration eventReport completed at: ${endTime.toLocaleString()}`)
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  process.exit(0)
}

async function doMigrate(
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  existingProgramId: number,
  platformProgramId: number,
  eventIds: number[]
) {
  //get all data in joined query

  const eventData = await migrationDB
    .selectFrom("event_reports as e")
    .select([
      "e.id",
      "e.entity_id", //need convert
      "e.has_order",
      "e.order_id", //need convert
      "e.no_packing_slip as do_number",
      "e.arrived_date",
      "e.status as status_id", //need convert
      "e.link",
      "e.created_by", //need convert
      "e.updated_by", //need convert
      "e.created_at",
      "e.updated_at",
      "e.deleted_at",
    ])
    .where("e.id", "in", eventIds)
    .execute()

  if (eventData.length === 0) return

  const [mapEntityIds, mapOrderIds, mapCreatedByIds, mapUpdatedByIds] =
    await Promise.all([
      getMapEntityIds(platformProgramId, collect(eventData, "entity_id")),
      getMapOrderIds(platformProgramId, collect(eventData, "order_id")),
      getMapUserIds(platformProgramId, collect(eventData, "created_by")),
      getMapUserIds(platformProgramId, collect(eventData, "updated_by")),
    ])

  const eventReportMap = new Map()
  const result = await trx
    .insertInto("ws_event_reports")
    .values(
      eventData.map((item) => {
        const v = {
          program_id: platformProgramId,
          entity_id: mapEntityIds[item.entity_id] ?? 0,
          has_order: item.has_order,
          order_id: item.order_id ? mapOrderIds[item.order_id] : null,
          do_number: item.do_number,
          arrived_date: item.arrived_date,
          status_id: newStatusMapping[item.status_id],
          link: item.link,
          created_by: item.created_by ? mapCreatedByIds[item.created_by] : null,
          updated_by: item.updated_by ? mapUpdatedByIds[item.updated_by] : null,
          deleted_by: null,
          created_at: item.created_at,
          updated_at: item.updated_at,
          deleted_at: item.deleted_at,
        }
        eventReportMap.set(item.id, v)

        return v
      })
    )
    .executeTakeFirst()

  const eventReportNewIds = Array.from(
    { length: eventData.length },
    (_, i) => Number(result.insertId) + i
  )

  const newEventIdsMap = new Map<number, number>()

  let index = 0
  for (const [oldId] of eventReportMap) {
    const newId = eventReportNewIds[index]
    if (newId) {
      newEventIdsMap.set(oldId, newId)
    }
    index++
  }

  const eventReportsPlatformMappings = {}
  newEventIdsMap.forEach((newId, oldId) => {
    eventReportsPlatformMappings[oldId] = newId
  })
  await insertTableMapping(
    "event_reports",
    platformProgramId,
    eventReportsPlatformMappings
  )

  const oldComments = await migrationDB
    .selectFrom("event_report_comments as e")
    .where("event_report_id", "in", eventIds)
    .select([
      "e.event_report_id",
      "e.comment",
      "e.user_id as created_by",
      "e.created_at",
      "e.updated_at",
      "e.deleted_at",
    ])
    .execute()

  if (oldComments.length > 0) {
    const [mapCreatedByIds_2] = await Promise.all([
      getMapUserIds(platformProgramId, collect(oldComments, "created_by")),
    ])
    const values = oldComments.map((item) => {
      return {
        report_id: newEventIdsMap.get(item.event_report_id ?? 0) ?? 0,
        comment: item.comment ?? "",
        created_by: mapCreatedByIds_2[item.created_by ?? 0] ?? 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
        deleted_at: item.deleted_at,
      }
    })
    await trx.insertInto("ws_event_report_comments").values(values).execute()
  }

  //items
  const oldItems = await migrationDB
    .selectFrom("event_report_items")
    .select([
      "event_report_id",
      "material_id", //need convert
      "custom_material",
      "no_batch",
      "expired_date",
      "production_date",
      "qty",
      "reason_id", //need convert
      "child_reason_id", //need convert
      "created_at",
      "updated_at",
      "deleted_at",
    ])
    .execute()

  if (oldItems.length > 0) {
    const [mapMaterialIds] = await Promise.all([
      getMapMaterialIds(platformProgramId, collect(oldItems, "material_id")),
    ])
    const values = oldItems.map((item) => {
      const eventReport = eventReportMap.get(item.event_report_id)
      let created_by = 0
      if (eventReport) {
        created_by = eventReport.created_by
      }

      return {
        report_id: newEventIdsMap.get(item.event_report_id ?? 0) ?? 0,
        material_id: item.material_id
          ? (mapMaterialIds[item.material_id] ?? 0)
          : 0,
        custom_material: item.custom_material,
        no_batch: item.no_batch,
        expired_date: item.expired_date,
        production_date: item.production_date,
        qty: item.qty,
        reason_id: item.reason_id,
        child_reason_id: newChildReasonMapping[item.child_reason_id ?? 0],
        created_by: created_by,
        created_at: item.created_at,
        updated_at: item.updated_at,
        deleted_at: item.deleted_at,
      }
    })
    await trx.insertInto("ws_event_report_items").values(values).execute()
  }

  //histories
  const oldHistories = await migrationDB
    .selectFrom("event_report_histories as e")
    .select([
      "e.event_report_id",
      "e.status as status_id", //need convert
      "e.updated_by as created_by", //need convert
      "e.created_at",
      "e.updated_at",
    ])
    .execute()

  if (oldHistories.length > 0) {
    const [mapCreatedByIds_3] = await Promise.all([
      getMapUserIds(platformProgramId, collect(oldHistories, "created_by")),
    ])
    const values = oldHistories.map((item) => {
      return {
        report_id: newEventIdsMap.get(item.event_report_id ?? 0) ?? 0,
        status_id: newStatusMapping[item.status_id ?? 0],
        created_by: mapCreatedByIds_3[item.created_by] ?? 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }
    })
    await trx.insertInto("ws_event_report_histories").values(values).execute()
  }
}

export const deleteEventReportRelations = async (programId = IMMUNIZATION) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = sql.join(
    platformProgramIds.map((id) => sql`${id}`),
    sql`, `
  )

  await sql`
    DELETE erhi, eri, erc, er
    FROM ws_event_reports er
    LEFT JOIN ws_event_report_comments erc ON erc.report_id = er.id
    LEFT JOIN ws_event_report_items eri ON eri.report_id = er.id
    LEFT JOIN ws_event_report_histories erhi ON erhi.report_id = er.id
    WHERE er.program_id IN (${idsSql})
  `.execute(db)

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_event_reports")
  await resetIncrement(db, "ws_event_report_comments")
  await resetIncrement(db, "ws_event_report_items")
  await resetIncrement(db, "ws_event_report_histories")
}
