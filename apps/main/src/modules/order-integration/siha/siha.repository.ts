import { WsOrderAudits } from "@/common/infrastructure/database/types/db.js"
import { Context } from "hono"
import { Updateable } from "kysely"
import { OrderIntegrationRepository } from "../order-integration.repository.js"

export class SihaRepository extends OrderIntegrationRepository {
  constructor() {
    super()
  }

  public updateOrderAudit = async (
    c: Context,
    orderId: number,
    isDraft: boolean
  ) => {
    const now = new Date()
    const { userId } = c.var

    const row: Updateable<WsOrderAudits> = {
      drafted_at: now,
      drafted_by: userId,
    }

    if (!isDraft) {
      row.validated_at = now
      row.validated_by = userId
    }

    return await c.var.trx
      .updateTable("ws_order_audits")
      .set(row)
      .where("order_id", "=", orderId)
      .execute()
  }
}
