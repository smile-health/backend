import { BaseRepository } from "../../base.repository.js"
import { Context } from "hono"
import {
  ChangeOrderItemStockAllocateDTO,
  AddOrderItemStockAllocateDTO,
  AddOrderHistoryAllocateDTO,
  UpdateOrderAuditAllocateDTO,
  ChangeStockAllocateDTO,
  AddOrderCommentAllocateDTO,
} from "./order-status-allocate.schema.js"

export class OrderStatusAllocateRepository extends BaseRepository<"ws_orders"> {
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

  async getOrderItemStockByOrderId(c: Context, orderId: number) {
    return await c.var.trx
      .selectFrom("ws_order_item_stocks as wois")
      .selectAll()
      .where("wois.order_id", "=", orderId)
      .where("wois.deleted_at", "is", null)
      .execute()
  }

  async updateOrderItemStockAllocateByOrderItemId(
    c: Context,
    id: number,
    req: ChangeOrderItemStockAllocateDTO
  ) {
    const result = await c.var.trx
      .updateTable("ws_order_item_stocks")
      .set(req)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async createOrderItemStockAllocateByOrderItemId(
    c: Context,
    req: AddOrderItemStockAllocateDTO | any
  ) {
    return await c.var.trx
      .insertInto("ws_order_item_stocks")
      .values(req)
      .executeTakeFirst()
  }

  async createOrderHistoryAllocate(
    c: Context,
    req: AddOrderHistoryAllocateDTO
  ) {
    return await c.var.trx
      .insertInto("ws_order_histories")
      .values(req)
      .executeTakeFirst()
  }

  async updateOrderAuditAllocateByOrderId(
    c: Context,
    orderId: number,
    req: UpdateOrderAuditAllocateDTO
  ) {
    const result = await c.var.trx
      .updateTable("ws_order_audits")
      .set(req)
      .where("order_id", "=", orderId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async getStockByIds(c: Context, id: number[]) {
    return await c.var.trx
      .selectFrom("ws_stocks as wss")
      .selectAll()
      .forUpdate()
      .where("wss.id", "in", id)
      .where("wss.deleted_at", "is", null)
      .execute()
  }

  async updateStockAllocateById(
    c: Context,
    id: number,
    req: ChangeStockAllocateDTO
  ) {
    return await c.var.trx
      .updateTable("ws_stocks")
      .set(req)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
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

  async getStockVendorById(
    c: Context,
    id: number,
    entityId: number | null,
    materialId: number,
    programId: number
  ) {
    return c.var.trx
      .selectFrom("ws_stocks as ws")
      .innerJoin("ws_activities as wa", (join) =>
        join
          .onRef("ws.activity_id", "=", "wa.id")
          .on("wa.deleted_at", "is", null)
      )
      .selectAll()
      .where("ws.id", "=", id)
      .where("ws.entity_id", "=", entityId)
      .where("ws.material_id", "=", materialId)
      .where("wa.program_id", "=", programId)
      .executeTakeFirst()
  }

  async getOrderStockStatusById(c: Context, id: number) {
    const result = await c.var.trx
      .selectFrom("ws_order_stock_statuses")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async getActiveActivityListByCustomerId(
    c: Context,
    customerId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_entities as we")
      .innerJoin("ws_entity_activities as wea", (join) =>
        join
          .onRef("we.id", "=", "wea.entity_id")
          .on("wea.deleted_at", "is", null)
      )
      .innerJoin("ws_activities as wa", (join) =>
        join
          .onRef("wa.id", "=", "wea.activity_id")
          .on("wa.program_id", "=", programId)
          .on("wa.deleted_at", "is", null)
      )
      .where("we.id", "=", customerId)
      .select(["wa.id"])
      .execute()
  }

  async getDetailOrderItemByOrderId(c: Context, orderId: number) {
    const result = await c.var.trx
      .selectFrom("ws_order_item_stocks as wois")
      .select([
        "wois.order_id as order_id",
        "wois.id as order_item_stock_id",
        "wois.allocated_qty",
        "wois.stock_id",
        "wois.order_stock_status_id",
      ])
      .where("wois.order_id", "=", orderId)
      .where("wois.deleted_at", "is", null)
      .execute()
    return result
  }

  async createOrderCommentAllocate(
    c: Context,
    req: AddOrderCommentAllocateDTO
  ) {
    return await c.var.trx
      .insertInto("ws_order_comments")
      .values(req)
      .executeTakeFirst()
  }

  async getMaterialRelationByMaterialId(c: Context, materialId: number) {
    return await c.var.trx
      .selectFrom("material_relations as mr")
      .selectAll()
      .where("mr.parent_material_id", "=", materialId)
      .where("deleted_at", "is", null)
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
