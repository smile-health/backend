import { slave } from "@/common/infrastructure/database/slave.js"
import { sql } from "kysely"

interface Order {
  id: number
  order_id: number
}
export class OrderClickhouse {
  async create(order: Order) {
    await sql`INSERT INTO ws_order_lists SELECT * FROM mysql_ws_order_lists WHERE order_id = ${order.id}`.execute(
      slave
    )
  }

  async updateStatus(order: Order) {
    await sql`
      ALTER TABLE ws_order_lists
      UPDATE
        status_id = (
          SELECT status_id
          FROM mysql_ws_order_lists
          WHERE order_id = ${order.order_id}
        ),
        status_name = (
          SELECT status_name
          FROM mysql_ws_order_lists
          WHERE order_id = ${order.order_id}
        )
      WHERE order_id = ${order.order_id}
    `.execute(slave)
  }

  async updateTotalOrderItems(order: Order) {
    await sql`
      ALTER TABLE ws_order_lists
      UPDATE
        total_order_items = (
          SELECT total_order_items
          FROM mysql_ws_order_lists
          WHERE order_id = ${order.order_id}
        )
      WHERE order_id = ${order.order_id}
    `.execute(slave)
  }
}
