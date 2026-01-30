import { db } from "@/common/infrastructure/database/index.js"
import {
  IntegrationLogs,
  IntegrationMappings,
  WsOrderItemStocks,
} from "@/common/infrastructure/database/types/db.js"
import { OrderRepository } from "@/modules/order/order.repository.js"
import { BadRequestError, NotFoundError } from "@smile-health/lib/error.js"
import { associate, associateField } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { Insertable, Updateable, sql } from "kysely"
import { DinGateway } from "./din/din.gateway.js"
import { SihaGateway } from "./siha/siha.gateway.js"

export class OrderIntegrationRepository extends OrderRepository {
  constructor() {
    super()
  }

  public getOrderMetadata = async (c: Context, orderId: number) => {
    const order = await c.var.trx
      .selectFrom("ws_orders as o")
      .select("metadata")
      .where("id", "=", orderId)
      .executeTakeFirst()

    const items = await c.var.trx
      .selectFrom("ws_order_item_stocks")
      .select(["qty", "validated_qty", "metadata"])
      .where("order_id", "=", orderId)
      .execute()

    return {
      order: { metadata: order?.metadata as unknown },
      items: items.map((item) => ({
        qty: item.qty ?? 0,
        validated_qty: item.validated_qty ?? 0,
        metadata: item.metadata as unknown,
      })),
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

  public getClientGateway = async (c: Context, clientKey: string) => {
    const client = await this.getClientByKey(c, clientKey)
    if (!client) throw new NotFoundError("Client not found")

    switch (client.key) {
      case "siha":
      case "sitb":
        return new SihaGateway(client)

      case "din":
        return new DinGateway(client)

      default:
        throw new NotFoundError("Client not implemented")
    }
  }

  public getInternalId = async (
    c: Context,
    type: string,
    externalId: string
  ) => {
    const { client, trx } = c.var
    if (!client) {
      throw new BadRequestError("Client is not validated")
    }

    const row = await trx
      .selectFrom("integration_mappings")
      .select("internal_id")
      .where("external_id", "=", externalId)
      .where("client_id", "=", client.id)
      .where("type", "=", type)
      .executeTakeFirst()

    return row?.internal_id
  }

  public getInternalToExternalMappings = async (
    c: Context,
    internalIds: number[],
    type = "material"
  ) => {
    if (internalIds.length === 0) {
      return {}
    }

    const { client, trx } = c.var
    if (!client) {
      throw new BadRequestError("Client is not validated")
    }

    const rows = await trx
      .selectFrom("integration_mappings as im")
      .select(["external_id", "internal_id"])
      .where("internal_id", "in", internalIds)
      .where("type", "=", type)
      .where("client_id", "=", client.id)
      .execute()

    return associateField(rows, "internal_id", "external_id")
  }

  public getOrderIdByKeySSL = async (c: Context, externalOrderId: string) => {
    const row = await c.var.trx
      .selectFrom("integration_mappings as im")
      .select("im.internal_id as order_id")
      .where("external_id", "=", externalOrderId)
      .where("type", "=", "order")
      .executeTakeFirst()

    return row?.order_id
  }

  public getMapOrderItemIdByKFACode = async (c: Context, orderId: number) => {
    const rows = await c.var.trx
      .selectFrom("ws_order_item_stocks as ois")
      .innerJoin("ws_materials as m", "m.id", "ois.material_id")
      .select(["ois.id", "m.hierarchy_code"])
      .where("ois.order_id", "=", orderId)
      .execute()

    return associateField(rows, "hierarchy_code", "id")
  }

  public getEntityMappings = async (
    c: Context,
    programId: number,
    externalEntityIds: number[]
  ) => {
    if (externalEntityIds.length === 0) {
      return {}
    }

    const rows = await c.var.trx
      .selectFrom("ws_entities")
      .select(["id", "id_satu_sehat"])
      .where("program_id", "=", programId)
      .where("id_satu_sehat", "in", externalEntityIds)
      .execute()

    return associateField(rows, "id_satu_sehat", "id")
  }

  public getMaterialMappings = async (
    c: Context,
    programId: number,
    externalMaterialIds: string[]
  ) => {
    if (externalMaterialIds.length === 0) {
      return {}
    }

    const { client, trx } = c.var
    const rows = await trx
      .selectFrom("ws_materials as wm")
      .leftJoin("integration_mappings as im", (join) =>
        join
          .onRef("im.internal_id", "=", "wm.hierarchy_code")
          .on("im.client_id", "=", client.id)
          .on("im.type", "=", "material")
      )
      .select([
        "wm.id",
        "wm.parent_id",
        sql<string>`coalesce(im.external_id, wm.hierarchy_code)`.as(
          "hierarchy_code"
        ),
      ])
      .where("wm.program_id", "=", programId)
      .where("wm.deleted_at", "is", null)
      .where((qb) =>
        qb.or([
          qb("wm.hierarchy_code", "in", externalMaterialIds),
          qb("im.external_id", "in", externalMaterialIds),
        ])
      )
      .execute()

    return associate(rows, "hierarchy_code")
  }

  public createOrderItems = async (
    c: Context,
    orderItems: Insertable<WsOrderItemStocks>[]
  ) => {
    return await c.var.trx
      .insertInto("ws_order_item_stocks")
      .values(orderItems)
      .execute()
  }

  public createMappings = async (
    c: Context,
    row: Insertable<IntegrationMappings>
  ) => {
    return await c.var.trx
      .insertInto("integration_mappings")
      .values(row)
      .execute()
  }

  public createLog = async (row: Insertable<IntegrationLogs>) => {
    return await db.insertInto("integration_logs").values(row).execute()
  }

  public updateLog = async (
    c: Context,
    id: number,
    row: Updateable<IntegrationLogs>
  ) => {
    return await c.var.trx
      .updateTable("integration_logs")
      .set(row)
      .where("id", "=", id)
      .execute()
  }
}
