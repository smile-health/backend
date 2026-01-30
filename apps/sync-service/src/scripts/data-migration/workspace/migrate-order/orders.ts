import { collect, getUniqueIdsFromFields } from "@smile-health/lib/utils.js"
import { Kysely, Transaction, sql } from "kysely"
import {
  getMapActivityIds,
  getMapEntityIds,
  getMapUserIds,
  insertTableMapping,
} from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateOrders = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  orderIds: number[]
) => {
  const orders = await migrationDB
    .selectFrom("orders as o")
    .leftJoin("order_items as oi", "oi.order_id", "o.id")
    .selectAll("o")
    .select([sql<number>`COUNT(oi.order_id)`.as("total_order_items")])
    .where("o.id", "in", orderIds)
    .where("o.deleted_at", "is", null)
    .groupBy(["o.id"])
    .execute()

  const mapUserIds = await getMapUserIds(
    programId,
    getUniqueIdsFromFields(
      orders,
      "created_by",
      "updated_by",
      "confirmed_by",
      "shipped_by",
      "fulfilled_by",
      "cancelled_by",
      "allocated_by"
    )
  )
  const mapEntityIds = await getMapEntityIds(
    programId,
    collect(orders, "customer_id", "vendor_id")
  )
  const mapActivityIds = await getMapActivityIds(
    programId,
    collect(orders, "activity_id")
  )

  const res = await trx
    .insertInto("ws_orders")
    .values(
      orders.map((order) => {
        let orderType = order.type
        // New order type "4" in 5.0: Central Distirbution
        if (order.type === 2 && order.is_manual === 1) {
          orderType = 4
        }

        return {
          customer_id: mapEntityIds[order.customer_id ?? 0] ?? 0,
          vendor_id: mapEntityIds[order.vendor_id ?? 0] ?? 0,
          activity_id: mapActivityIds[order.activity_id ?? 0],
          order_status_id: order.status,
          order_type_id: orderType,
          delivery_type_id: order.service_type,
          purchase_ref: order.purchase_ref,
          sales_ref: order.sales_ref,
          delivery_number: order.delivery_number,
          device_type: order.device_type,
          is_allocated: Number(order.is_allocated),
          taken_by_customer: Number(order.taken_by_customer),
          biofarma_changed: Number(order.biofarma_changed),
          no_document: order.no_document,
          notes: order.notes,
          no_po: order.no_po,
          total_order_items: order.total_order_items,
          created_at: order.created_at,
          created_by: mapUserIds[order.created_by ?? 0] ?? 0,
          updated_at: order.updated_at,
          updated_by: mapUserIds[order.updated_by ?? 0] ?? 0,
        }
      })
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: orderIds.length },
    (_, i) => Number(res.insertId) + i
  )
  const mapGlobalIds = {}
  for (const [i, order] of orders.entries()) {
    mapGlobalIds[order.id] = insertedIds[i]
  }

  await insertTableMapping("orders", programId, mapGlobalIds)

  await trx
    .insertInto("ws_order_audits")
    .values(
      orders.map((order) => ({
        order_id: mapGlobalIds[order.id],
        released_date: order.released_date,
        required_date: order.required_date,
        estimated_date: order.estimated_date,
        actual_shipment_date: order.actual_shipment,
        confirmed_by: mapUserIds[order.confirmed_by ?? 0] ?? 0,
        shipped_by: mapUserIds[order.shipped_by ?? 0] ?? 0,
        fulfilled_by: mapUserIds[order.fulfilled_by ?? 0] ?? 0,
        cancelled_by: mapUserIds[order.cancelled_by ?? 0] ?? 0,
        allocated_by: mapUserIds[order.allocated_by ?? 0] ?? 0,
        confirmed_at: order.confirmed_at,
        shipped_at: order.shipped_at,
        fulfilled_at: order.fulfilled_at,
        cancelled_at: order.cancelled_at,
        allocated_at: order.allocated_at,
        created_at: order.created_at,
        updated_at: order.updated_at,
      }))
    )
    .executeTakeFirst()

  const orderWithOtherReasons = orders.filter((order) => !!order.other_reason)
  if (orderWithOtherReasons.length === 0) {
    return mapGlobalIds
  }

  await trx
    .insertInto("ws_other_reasons")
    .values(
      orderWithOtherReasons.map((order) => ({
        source_id: mapGlobalIds[order.id],
        source_type: "order",
        content: order.other_reason,
      }))
    )
    .executeTakeFirst()

  return mapGlobalIds
}
