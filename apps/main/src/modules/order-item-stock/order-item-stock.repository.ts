import { Context } from "hono"
import { sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import {
  AddOtherReasonDTO,
  EditOrderDTO,
} from "../order-item-stock/order-item-stock.schema.js"

export class OrderItemStockRepository extends BaseRepository<"ws_order_item_stocks"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_order_item_stocks", filterProgram, filterActivity)
  }

  async getOrderById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_orders as wso")
      .selectAll()
      .leftJoin("ws_activities as wsa", (join) =>
        join
          .onRef("wsa.id", "=", "wso.activity_id")
          .on("wsa.program_id", "=", programId)
          .on("wsa.deleted_at", "is", null)
      )
      .where("wso.id", "=", id)
      .where("wso.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async createOtherReason(c: Context, req: AddOtherReasonDTO) {
    return await c.var.trx
      .insertInto("ws_other_reasons")
      .values(req)
      .executeTakeFirst()
  }

  // async updateOtherReason(
  //   c: Context,
  //   sourceId: number,
  //   sourceType: string,
  //   req: EditOtherReasonDTO
  // ) {
  //   const result = await c.var.trx
  //     .updateTable("ws_other_reasons")
  //     .set(req)
  //     .where("source_id", "=", sourceId)
  //     .where("source_type", "=", sourceType)
  //     .where("deleted_at", "is", null)
  //     .executeTakeFirst()
  //   return result
  // } * same as deleteOtherReason

  async getOtherReasonBySourceIdAndSourceType(
    c: Context,
    sourceId: number,
    sourceType: string
  ) {
    const result = await c.var.trx
      .selectFrom("ws_other_reasons")
      .selectAll()
      .where("source_id", "=", sourceId)
      .where("source_type", "=", sourceType)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async deleteOtherReason<T extends { [key: string]: number | Date | string }>(
    c: Context,
    sourceId: number,
    sourceType: string,
    req: T
  ) {
    const result = await c.var.trx
      .updateTable("ws_other_reasons")
      .set(req)
      .where("source_id", "=", sourceId)
      .where("source_type", "=", sourceType)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async getMaterialById(c: Context, id: number, programId: number) {
    const result = await c.var.trx
      .selectFrom("ws_materials")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async getMaterialLevelById(c: Context, id: number) {
    const result = await c.var.trx
      .selectFrom("material_levels")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async getOrderReasonById(c: Context, id: number) {
    const result = await c.var.trx
      .selectFrom("ws_order_reasons")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async getItemMaterialByOrderMaterialId(
    c: Context,
    orderId: number,
    materialId: number
  ) {
    const result = await c.var.trx
      .selectFrom("ws_order_item_stocks")
      .selectAll()
      .where("order_id", "=", orderId)
      .where("material_id", "=", materialId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async getItemByItemOrderId(c: Context, id: number, orderId: number) {
    const result = await c.var.trx
      .selectFrom("ws_order_item_stocks")
      .selectAll()
      .where("id", "=", id)
      .where("order_id", "=", orderId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async getStockCustomerVendorByWsMaterialIds(
    c: Context,
    entityId: number | null,
    programId: number,
    materialId: number
  ) {
    return c.var.trx
      .selectFrom("ws_stocks as ws")
      .innerJoin("ws_activities as wa", (join) =>
        join
          .onRef("ws.activity_id", "=", "wa.id")
          .on("wa.program_id", "=", programId)
          .on("wa.deleted_at", "is", null)
      )
      .select([
        "wa.program_id",
        "ws.entity_id",
        "ws.material_id",
        sql`coalesce(sum(ws.qty), 0)`.as("total_qty"),
        sql`coalesce(sum(ws.in_transit_qty), 0)`.as("total_in_transit_qty"),
        sql`coalesce(sum(ws.allocated_qty), 0)`.as("total_allocated_qty"),
        sql`coalesce(sum(ws.qty - ws.allocated_qty), 0)`.as(
          "total_available_qty"
        ),
      ])
      .where("entity_id", "=", entityId)
      .where("material_id", "=", materialId)
      .where("ws.deleted_at", "is", null)
      .groupBy(["wa.program_id", "ws.entity_id", "ws.material_id"])
      .execute()
  }

  async updateOrder(c: Context, id: number, req: EditOrderDTO) {
    const result = await c.var.trx
      .updateTable("ws_orders")
      .set(req)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async getOrderItemStockByIds(c: Context, ids: number[]) {
    const result = await c.var.trx
      .selectFrom("ws_order_item_stocks as wois")
      .leftJoin("materials as m", "m.id", "wois.material_id")
      .select([
        "wois.id",
        "wois.order_id",
        "wois.material_id",
        "wois.stock_id",
        "wois.order_stock_status_id",
        "wois.qty",
        "wois.ordered_qty",
        "wois.allocated_qty",
        "wois.confirmed_qty",
        "wois.received_qty",
        "wois.recommended_stock",
        "wois.order_reason_id",
        "wois.fulfill_reason",
        "wois.fulfill_status",
        "wois.qrcode",
        "m.code",
      ])
      .where("wois.id", "in", ids)
      .where("wois.deleted_at", "is", null)
      .execute()
    return result
  }

  async getWsMaterialByMaterialIds(
    c: Context,
    materialId: number[],
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_materials as wm")
      .selectAll()
      .where("wm.id", "in", materialId)
      .where("wm.program_id", "=", programId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getMaterialRelationByMaterialId(c: Context, materialId: number) {
    return await c.var.trx
      .selectFrom("material_relations as mr")
      .selectAll()
      .where("mr.parent_material_id", "=", materialId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getChildItemByOrderParentMaterialId(
    c: Context,
    orderId: number,
    materialId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_order_item_stocks as wois")
      .selectAll()
      .where("wois.order_id", "=", orderId)
      .where("wois.parent_material_id", "=", materialId)
      .where("deleted_at", "is", null)
      .execute()
  }
}
