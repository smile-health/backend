import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const ORDER_CANCEL_REASON = {
    REQUEST: 1,
    DOUBLE: 2,
    WRONG: 3,
    OTHERS: 4,
  }

  const OrderCancelReasonData = [
    { id: ORDER_CANCEL_REASON.REQUEST, name: "request" },
    { id: ORDER_CANCEL_REASON.DOUBLE, name: "double" },
    { id: ORDER_CANCEL_REASON.WRONG, name: "wrong" },
    { id: ORDER_CANCEL_REASON.OTHERS, name: "others" },
  ]

  await db
    .insertInto("ws_order_cancel_reasons")
    .values(OrderCancelReasonData)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`truncate table ws_order_cancel_reasons`.execute(db)
}
