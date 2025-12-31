import { BaseRepository } from "../../base.repository.js"
import { Context } from "hono"
import {
  ChangeOrderItemStockCancelAllocatedDTO,
  AddOrderHistoryCancelDTO,
  UpdateOrderAuditCancelDTO,
  AddOtherReasonCancelDTO,
  AddOrderCommentCancelDTO,
  ChangeStockShipToCancelDTO,
  ChangeStockAllocateToCancelDTO,
  AddTransactionCancelDTO,
  AddPurchaseCancelDTO,
  AddStockCustomerCancelDTO,
} from "./order-status-cancel.schema.js"

export class OrderStatusCancelRepository extends BaseRepository<"ws_orders"> {
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
      .selectFrom("ws_stocks as ws")
      .innerJoin("ws_order_item_stocks as wois", (join) =>
        join
          .onRef("wois.stock_id", "=", "ws.id")
          .on("wois.order_id", "=", orderId)
          .on("wois.deleted_at", "is", null)
      )
      .leftJoin("ws_batches as wb", (join) =>
        join.onRef("ws.batch_id", "=", "wb.id").on("ws.deleted_at", "is", null)
      )
      .forUpdate()
      .select([
        "ws.id as stock_id",
        "ws.qty as stock_qty",
        "ws.allocated_qty as stock_allocated_qty",
        "ws.in_transit_qty as stock_in_transit_qty",
        "ws.activity_id as stock_activity_id",
        "ws.entity_id as stock_entity_id",
        "wois.id as item_stock_id",
        "wois.allocated_qty as item_stock_allocated_qty",
        "wb.code as batch_code",
        "ws.budget_source_id",
        "ws.year",
        "ws.price",
        "ws.batch_id",
        "ws.material_id as stock_material_id",
        "ws.parent_material_id",
        "ws.manufacture_id",
        "ws.parent_material_id",
      ])
      .where("ws.deleted_at", "is", null)
      .execute()
  }

  async updateOrderItemStockCancelById(
    c: Context,
    id: number,
    req: ChangeOrderItemStockCancelAllocatedDTO
  ) {
    const result = await c.var.trx
      .updateTable("ws_order_item_stocks")
      .set(req)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async createOrderHistoryCancel(c: Context, req: AddOrderHistoryCancelDTO) {
    return await c.var.trx
      .insertInto("ws_order_histories")
      .values(req)
      .executeTakeFirst()
  }

  async updateOrderAuditCancelByOrderId(
    c: Context,
    orderId: number,
    req: UpdateOrderAuditCancelDTO
  ) {
    const result = await c.var.trx
      .updateTable("ws_order_audits")
      .set(req)
      .where("order_id", "=", orderId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async createOtherReasonCancel(c: Context, req: AddOtherReasonCancelDTO) {
    return await c.var.trx
      .insertInto("ws_other_reasons")
      .values(req)
      .executeTakeFirst()
  }

  async createOrderCommentCancel(c: Context, req: AddOrderCommentCancelDTO) {
    return await c.var.trx
      .insertInto("ws_order_comments")
      .values(req)
      .executeTakeFirst()
  }

  async updateStockVendorCustomerCancelById(
    c: Context,
    id: number,
    req: ChangeStockShipToCancelDTO | ChangeStockAllocateToCancelDTO
  ) {
    return await c.var.trx
      .updateTable("ws_stocks")
      .set(req)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async createTransactionCancel(c: Context, req: AddTransactionCancelDTO) {
    return await c.var.trx
      .insertInto("ws_transactions")
      .values(req)
      .executeTakeFirst()
  }

  async getOrderCancelReasonById(c: Context, id: number) {
    const result = await c.var.trx
      .selectFrom("ws_order_cancel_reasons")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async createPurchaseShip(c: Context, req: AddPurchaseCancelDTO) {
    return await c.var.trx
      .insertInto("ws_purchases")
      .values(req)
      .executeTakeFirst()
  }

  async getStockCustomers(
    c: Context,
    entityId: number | null,
    activityIds: number[],
    materialIds: number[],
    batchIds: number[]
  ) {
    return await c.var.trx
      .selectFrom("ws_stocks as ws")
      .where("entity_id", "=", entityId)
      .where("activity_id", "in", activityIds)
      .where("material_id", "in", materialIds)
      .where("batch_id", "in", batchIds)
      .where("ws.deleted_at", "is", null)
      .forUpdate()
      .selectAll("ws")
      .execute()
  }

  async getStockCustomersNoBatch(
    c: Context,
    entityId: number | null,
    activityIds: number[],
    materialIds: number[]
  ) {
    const result = await c.var.trx
      .selectFrom("ws_stocks as ws")
      .forUpdate()
      .selectAll()
      .where("ws.batch_id", "is", null)
      .where("ws.entity_id", "=", entityId)
      .where("ws.activity_id", "in", activityIds)
      .where("ws.material_id", "in", materialIds)
      .where("ws.deleted_at", "is", null)
      .execute()
    return result
  }

  async getWsPurchaseByOrderId(
    c: Context,
    orderId: number,
    transactionTypeId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_purchases as wp")
      .innerJoin("ws_transactions as wt", (join) =>
        join.onRef("wp.source_id", "=", "wt.id").on("wt.deleted_at", "is", null)
      )
      .select([
        "wp.id as purchase_id",
        "wt.id as transaction_id",
        "wt.change_qty",
        "wt.stock_id",
        "wp.price",
        "wp.total_price",
        "wp.budget_source_id",
        "wp.year",
      ])
      .where("wt.order_id", "=", orderId)
      .where("wp.source_type", "=", "transaction")
      .where("wp.deleted_at", "is", null)
      .where("wt.transaction_type_id", "=", transactionTypeId)
      .execute()
  }

  async createStockCustomerCancel(c: Context, req: AddStockCustomerCancelDTO) {
    return await c.var.trx
      .insertInto("ws_stocks")
      .values(req)
      .executeTakeFirst()
  }
}
