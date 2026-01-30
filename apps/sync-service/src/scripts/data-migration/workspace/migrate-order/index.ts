import { collect } from "@smile-health/lib/utils.js"
import { sql } from "kysely"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import { deleteTableMapping, resetIncrement } from "../../../helper.js"
import {
  MAP_EXISTING_ACTIVITY_IDS,
  MAP_EXISTING_TO_PLATFORM,
} from "../../const.js"
import { IMMUNIZATION } from "../../constants/program.js"
import { migrateOrderComments } from "./order-comments.js"
import { migrateOrderHistories } from "./order-histories.js"
import { migrateOrderItemProjectionCapacities } from "./order-item-projection-capacities.js"
import { migrateOrderItems } from "./order-items.js"
import { migrateOrders } from "./orders.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateOrderAndRelations = async (
  batchSize: number,
  programId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.log(
    `Migration order and relations started at: ${startTime.toLocaleString()}`
  )
  console.info("migration start...")

  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting immunization order relations...")
    await deleteOrderRelations(programId)
  }
  const migrationDB = getMigrationDB(programId)
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  for (const progId of platformProgramIds) {
    const activityIds = MAP_EXISTING_ACTIVITY_IDS[progId]
    if (activityIds?.length === 0) {
      continue
    }

    let page = 0
    while (true) {
      const rows = await migrationDB
        .selectFrom("orders as o")
        .select(["o.id"])
        .where("o.deleted_at", "is", null)
        .where("o.activity_id", "in", activityIds ?? [-1])
        .orderBy("o.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const orderIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        const mapGlobalIds = await migrateOrders(
          trx,
          migrationDB,
          progId,
          orderIds
        )

        await Promise.all([
          migrateOrderComments(
            trx,
            migrationDB,
            progId,
            orderIds,
            mapGlobalIds
          ),
          migrateOrderHistories(
            trx,
            migrationDB,
            progId,
            orderIds,
            mapGlobalIds
          ),
          migrateOrderItems(trx, migrationDB, progId, orderIds, mapGlobalIds),
          migrateOrderItemProjectionCapacities(
            trx,
            migrationDB,
            progId,
            orderIds,
            mapGlobalIds
          ),
        ])
      })

      page++
      console.log(`program ${progId}, batch ${page} is finished`)
    }
  }

  const endTime = new Date()
  console.log(
    `Migration order and relations completed at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  console.log("migration finished")
  process.exit(0)
}

export const deleteOrderRelations = async (programId = IMMUNIZATION) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = sql.join(
    platformProgramIds.map((id) => sql`${id}`),
    sql`, `
  )

  const firstOrder = await db
    .selectFrom("ws_orders as o")
    .select("o.id")
    .innerJoin("ws_activities as a", "a.id", "o.activity_id")
    .where("a.program_id", "in", platformProgramIds)
    .orderBy("o.id")
    .executeTakeFirst()

  if (!firstOrder) {
    console.log("No rows to truncate, skipping")
    return
  }

  await Promise.all([
    sql`
      DELETE oi, oir
      FROM ws_order_item_stocks oi
      LEFT JOIN ws_other_reasons oir ON (oir.source_type = 'order_item' AND oir.source_id = oi.id)
      AND oi.order_id >= ${firstOrder?.id ?? 0}
    `.execute(db),
    db.deleteFrom("ws_orders").where("id", ">=", firstOrder.id).execute(),
    db
      .deleteFrom("ws_order_audits")
      .where("order_id", ">=", firstOrder.id)
      .execute(),
    db
      .deleteFrom("ws_order_comments")
      .where("order_id", ">=", firstOrder.id)
      .execute(),
    db
      .deleteFrom("ws_order_histories")
      .where("order_id", ">=", firstOrder.id)
      .execute(),
    db
      .deleteFrom("ws_order_item_projection_capacities")
      .where("order_id", ">=", firstOrder.id)
      .execute(),
    db
      .deleteFrom("ws_other_reasons")
      .where("source_type", "=", "order")
      .where("source_id", ">=", firstOrder.id)
      .execute(),
  ])

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_orders")
  await resetIncrement(db, "ws_order_item_stocks")
  await resetIncrement(db, "ws_order_comments")
  await resetIncrement(db, "ws_order_histories")
  await resetIncrement(db, "ws_order_item_stocks")
  await resetIncrement(db, "ws_order_item_projection_capacities")
  await resetIncrement(db, "ws_order_audits")
  await resetIncrement(db, "ws_other_reasons")

  await deleteTableMapping("orders", platformProgramIds)
  await deleteTableMapping("order_items", platformProgramIds)
  await deleteTableMapping("order_comments", platformProgramIds)
  await deleteTableMapping("order_histories", platformProgramIds)
  await deleteTableMapping(
    "order_item_projection_capacities",
    platformProgramIds
  )

  console.log("Done deleting immunization order relations")
}
