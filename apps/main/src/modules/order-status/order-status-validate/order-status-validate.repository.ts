import { BaseRepository } from "../../base.repository.js"
import { Context } from "hono"
import {
  ChangeOrderItemStockValidateDTO,
  AddOrderHistoryValidateDTO,
  AddOrderCommentValidateDTO,
  UpdateOrderAuditValidateDTO,
} from "./order-status-validate.schema.js"
import { sql } from "kysely"

export class OrderStatusValidateRepository extends BaseRepository<"ws_orders"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_orders", filterProgram, filterActivity)
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

  async updateOrderItemStockValidateByOrderItemId(
    c: Context,
    id: number,
    req: ChangeOrderItemStockValidateDTO
  ) {
    const result = await c.var.trx
      .updateTable("ws_order_item_stocks")
      .set(req)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async createOrderHistoryValidate(c: Context, req: AddOrderHistoryValidateDTO) {
    return await c.var.trx
      .insertInto("ws_order_histories")
      .values(req)
      .executeTakeFirst()
  }

  async createOrderCommentValidate(c: Context, req: AddOrderCommentValidateDTO) {
    return await c.var.trx
      .insertInto("ws_order_comments")
      .values(req)
      .executeTakeFirst()
  }

  async updateOrderAuditValidateByOrderId(
    c: Context,
    orderId: number,
    req: UpdateOrderAuditValidateDTO
  ) {
    const result = await c.var.trx
      .updateTable("ws_order_audits")
      .set(req)
      .where("order_id", "=", orderId)
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

  async getDetailOrderItemByOrderId(c: Context, orderId: number) {
    const result = await c.var.trx
      .selectFrom("ws_orders as wso")
      .innerJoin("ws_order_item_stocks as wois", (join) =>
        join
          .onRef("wois.order_id", "=", "wso.id")
          .on("wois.deleted_at", "is", null)
      )
      .innerJoin("ws_order_comments as woc", (join) =>
        join
          .onRef("woc.order_id", "=", "wso.id")
          .on("woc.deleted_at", "is", null)
      )
      .select([
        "wois.id",
        "wois.order_id",
        "wois.material_id",
        "wois.qty",
        "woc.id as comment_id",
        "woc.comment",
        "woc.created_at",
      ])
      .where("wso.id", "=", orderId)
      .where("wso.deleted_at", "is", null)
      .execute()

    return result
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

  async getMaterialRelationByMaterialId(c: Context, materialId: number) {
    return await c.var.trx
      .selectFrom("material_relations as mr")
      .selectAll()
      .where("mr.parent_material_id", "=", materialId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getStockCustomerVendorHierarchyByWsMaterialIds(
    c: Context,
    entityId: number | null,
    programId: number,
    materialIds: number[]
  ) {
    if (materialIds.length === 0) {
      return []
    }

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
      .where("material_id", "in", materialIds)
      .where("ws.deleted_at", "is", null)
      .groupBy(["wa.program_id", "ws.entity_id"])
      .execute()
  }

  async getMaterialByGlobalIds(c: Context, ids: number[], programId: number) {
    const result = await c.var.trx
      .selectFrom("ws_materials")
      .selectAll()
      .where("global_id", "in", ids)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .execute()
    return result
  }
}
