import { db } from "@/common/infrastructure/database/index.js"
import { slave } from "@/common/infrastructure/database/slave.js"
import { sql } from "kysely"

const formatDateTimeForClickHouse = (date: any): string | null => {
  if (!date || date === null) return null

  if (typeof date === "string") {
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) return null
    return parsed.toISOString().slice(0, 19).replace("T", " ")
  }

  if (date instanceof Date) {
    if (isNaN(date.getTime())) return null
    return date.toISOString().slice(0, 19).replace("T", " ")
  }

  return null
}

export const updateOrInsertOrderListClickHouse = async (orderId: number[]) => {
  console.log(`Syncing order list...`)

  await db.transaction().execute(async (trx) => {
    const orders = await trx
      .selectFrom("ws_order_lists")
      .where("order_id", "in", orderId)
      .selectAll()
      .execute()

    if (orders.length === 0) {
      console.error("not found order list")
      process.exit(1)
    }

    for (const order of orders) {
      const orderListClickHouse = await slave
        .selectFrom("ws_order_lists")
        .where("order_id", "=", order.order_id)
        .selectAll()
        .execute()

      if (orderListClickHouse.length === 0) {
        const formattedOrder = {
          order_created_at: formatDateTimeForClickHouse(order.order_created_at),
          order_updated_at: formatDateTimeForClickHouse(order.order_updated_at),
          confirmed_at: formatDateTimeForClickHouse(order.confirmed_at),
          shipped_at: formatDateTimeForClickHouse(order.shipped_at),
          fulfilled_at: formatDateTimeForClickHouse(order.fulfilled_at),
          cancelled_at: formatDateTimeForClickHouse(order.cancelled_at),
          allocated_at: formatDateTimeForClickHouse(order.allocated_at),
        }

        await sql`
          INSERT INTO ws_order_lists (
            order_id, device_type, status_id, status_name, type_id, delivery_type_id, 
            type_name, order_created_at, order_updated_at, total_order_items, user_created_by, 
            created_by_name, updated_by_name, vendor_id, vendor_name, vendor_entity_tag_id, 
            vendor_province_id, vendor_regency_id, customer_province_id, customer_regency_id, 
            customer_id, customer_name, activity_id, activity_name, program_id, confirmed_by, 
            shipped_by, fulfilled_by, cancelled_by, allocated_by, confirmed_at, shipped_at, 
            fulfilled_at, cancelled_at, allocated_at, delivery_type_name, doc_no, po_no, 
            purchase_ref, sales_ref, metadata
          )
          VALUES (
            ${order.order_id}, 
            ${order.device_type}, 
            ${order.status_id}, 
            ${order.status_name}, 
            ${order.type_id}, 
            ${order.delivery_type_id}, 
            ${order.type_name}, 
            ${formattedOrder.order_created_at}, 
            ${formattedOrder.order_updated_at}, 
            ${order.total_order_items}, 
            ${order.user_created_by}, 
            ${order.created_by_name}, 
            ${order.updated_by_name}, 
            ${order.vendor_id}, 
            ${order.vendor_name}, 
            ${order.vendor_entity_tag_id}, 
            ${order.vendor_province_id}, 
            ${order.vendor_regency_id}, 
            ${order.customer_province_id}, 
            ${order.customer_regency_id}, 
            ${order.customer_id}, 
            ${order.customer_name}, 
            ${order.activity_id}, 
            ${order.activity_name}, 
            ${order.program_id}, 
            ${order.confirmed_by}, 
            ${order.shipped_by}, 
            ${order.fulfilled_by}, 
            ${order.cancelled_by}, 
            ${order.allocated_by}, 
            ${formattedOrder.confirmed_at}, 
            ${formattedOrder.shipped_at}, 
            ${formattedOrder.fulfilled_at}, 
            ${formattedOrder.cancelled_at}, 
            ${formattedOrder.allocated_at}, 
            ${order.delivery_type_name}, 
            ${order.doc_no}, 
            ${order.po_no}, 
            ${order.purchase_ref}, 
            ${order.sales_ref}, 
            ${order.metadata}
          )
        `.execute(slave)
      } else {
        const formattedOrder = {
          order_created_at: formatDateTimeForClickHouse(order.order_created_at),
          order_updated_at: formatDateTimeForClickHouse(order.order_updated_at),
          confirmed_at: formatDateTimeForClickHouse(order.confirmed_at),
          shipped_at: formatDateTimeForClickHouse(order.shipped_at),
          fulfilled_at: formatDateTimeForClickHouse(order.fulfilled_at),
          cancelled_at: formatDateTimeForClickHouse(order.cancelled_at),
          allocated_at: formatDateTimeForClickHouse(order.allocated_at),
        }

        await sql`
          ALTER TABLE ws_order_lists
          UPDATE
            device_type = ${order.device_type},
            status_id = ${order.status_id},
            status_name = ${order.status_name},
            type_id = ${order.type_id},
            delivery_type_id = ${order.delivery_type_id},
            type_name = ${order.type_name},
            order_created_at = ${formattedOrder.order_created_at},
            order_updated_at = ${formattedOrder.order_updated_at},
            total_order_items = ${order.total_order_items},
            user_created_by = ${order.user_created_by},
            created_by_name = ${order.created_by_name},
            updated_by_name = ${order.updated_by_name},
            vendor_id = ${order.vendor_id},
            vendor_name = ${order.vendor_name},
            vendor_entity_tag_id = ${order.vendor_entity_tag_id},
            vendor_province_id = ${order.vendor_province_id},
            vendor_regency_id = ${order.vendor_regency_id},
            customer_province_id = ${order.customer_province_id},
            customer_regency_id = ${order.customer_regency_id},
            customer_id = ${order.customer_id},
            customer_name = ${order.customer_name},
            activity_id = ${order.activity_id},
            activity_name = ${order.activity_name},
            program_id = ${order.program_id},
            confirmed_by = ${order.confirmed_by},
            shipped_by = ${order.shipped_by},
            fulfilled_by = ${order.fulfilled_by},
            cancelled_by = ${order.cancelled_by},
            allocated_by = ${order.allocated_by},
            confirmed_at = ${formattedOrder.confirmed_at},
            shipped_at = ${formattedOrder.shipped_at},
            fulfilled_at = ${formattedOrder.fulfilled_at},
            cancelled_at = ${formattedOrder.cancelled_at},
            allocated_at = ${formattedOrder.allocated_at},
            delivery_type_name = ${order.delivery_type_name},
            doc_no = ${order.doc_no},
            po_no = ${order.po_no},
            purchase_ref = ${order.purchase_ref},
            sales_ref = ${order.sales_ref},
            metadata = ${order.metadata}
          WHERE order_id = ${order.order_id}
        `.execute(slave)
      }
    }
  })

  console.log("migration finished")
  process.exit(0)
}
