import { Kysely, Transaction } from "kysely"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"
import { collect } from "@smile-health/lib/utils.js"
import { insertTableMapping } from "@/scripts/helper.js"

export const migrateOrderItemProjectionCapacities = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  orderIds: number[],
  mapPlatformOrderIds = {}
) => {
  const projections = await migrationDB
    .selectFrom("order_item_projection_capacities as pc")
    .selectAll("pc")
    .where("order_id", "in", orderIds)
    .where("deleted_at", "is", null)
    .execute()

  if (projections.length === 0) {
    return
  }

  const orderItemProjectionIds = collect(projections, "id")

  const res = await trx
    .insertInto("ws_order_item_projection_capacities")
    .values(
      projections.map((projection) => ({
        order_id: mapPlatformOrderIds[projection.order_id],
        capacity_asset: projection.capacity_asset,
        total_volume: projection.total_volume,
        percent_capacity: projection.percent_capacity,
        is_confirm: projection.is_confirm,
        created_at: projection.created_at,
        updated_at: projection.updated_at,
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: orderItemProjectionIds.length },
    (_, i) => Number(res.insertId) + i
  )
  const mapPlatformOrderItemProjectionIds = {}
  for (const [i, projection] of projections.entries()) {
    mapPlatformOrderItemProjectionIds[projection.id] = insertedIds[i]
  }

  await insertTableMapping(
    "order_item_projection_capacities",
    programId,
    mapPlatformOrderItemProjectionIds
  )
}
