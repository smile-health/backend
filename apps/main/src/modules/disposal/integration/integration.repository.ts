import { db } from "@/common/infrastructure/database/index.js"
import { IntegrationLogs } from "@/common/infrastructure/database/types/db.js"
import { Context } from "hono"
import { Insertable } from "kysely"
import { Client } from "./integration.schema.js"
import { WMSClient } from "./wms/wms.client"
import { ValidationError } from "@smile/lib/error.js"

export class IntegrationRepository {
  public getClientByEntityId = async (
    c: Context,
    entityId: number
  ): Promise<Client> => {
    const client = await c.var.trx
      .selectFrom("integration_clients as ic")
      .innerJoin("integration_associations as ia", (join) =>
        join.onRef("ia.client_id", "=", "ic.id").on("ia.type", "=", "entity")
      )
      .innerJoin("entity_workspaces as ew", (join) =>
        join.onRef("ew.entity_id", "=", "ia.internal_id")
      )
      .where("ew.id", "=", entityId)
      .where("ew.workspace_id", "=", c.var.programId)
      .selectAll("ic")
      .executeTakeFirst()
    if (!client)
      throw new ValidationError(
        c.var.t("disposal_instruction.error.entity_not_integrated")
      )

    switch (client.key) {
      case "wms":
        return new WMSClient(client)

      default:
        throw new ValidationError(
          c.var.t("disposal_instruction.error.entity_not_integrated")
        )
    }
  }

  public getClientByKey = async (c: Context, clientKey?: string) => {
    if (!clientKey) return

    return await c.var.trx
      .selectFrom("integration_clients")
      .selectAll()
      .where("key", "=", clientKey)
      .executeTakeFirst()
  }

  public createLog = async (row: Insertable<IntegrationLogs>) => {
    return await db.insertInto("integration_logs").values(row).execute()
  }
}
