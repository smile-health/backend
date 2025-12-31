import { Context } from "hono"
import { BaseRepository } from "../../base.repository.js"
import {
  AddOrderCommentFulfilledDTO,
  AddOrderHistoryFulfilledDTO,
  AddStockCustomerFulfilledDTO,
  AddTransactionFulfilledDTO,
  ChangeOrderItemStockFulfilledDTO,
  ChangeStockVendorCustomerFulfilledDTO,
  UpdateOrderAuditFulfilledDTO,
  AddPurchaseFulfillDTO,
} from "./order-status-fulfilled.schema.js"

export class OrderStatusFulfilledRepository extends BaseRepository<"ws_orders"> {
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
      .innerJoin("ws_stocks as ws", (join) =>
        join
          .onRef("wois.stock_id", "=", "ws.id")
          .on("ws.deleted_at", "is", null)
      )
      .selectAll("wois")
      .select("ws.manufacture_id")
      .where("wois.order_id", "=", orderId)
      .where("wois.deleted_at", "is", null)
      .execute()
  }

  async updateOrderItemStockFulfilledByOrderStockId(
    c: Context,
    id: number,
    req: ChangeOrderItemStockFulfilledDTO
  ) {
    const result = await c.var.trx
      .updateTable("ws_order_item_stocks")
      .set(req)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async createOrderHistoryFulfilled(
    c: Context,
    req: AddOrderHistoryFulfilledDTO
  ) {
    return await c.var.trx
      .insertInto("ws_order_histories")
      .values(req)
      .executeTakeFirst()
  }

  async updateOrderAuditFulfilledByOrderId(
    c: Context,
    orderId: number,
    req: UpdateOrderAuditFulfilledDTO
  ) {
    const result = await c.var.trx
      .updateTable("ws_order_audits")
      .set(req)
      .where("order_id", "=", orderId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async createOrderCommentFulfilled(
    c: Context,
    req: AddOrderCommentFulfilledDTO
  ) {
    return await c.var.trx
      .insertInto("ws_order_comments")
      .values(req)
      .executeTakeFirst()
  }

  // async updateStockVendorFulfilledById(
  //   c: Context,
  //   id: number,
  //   req: ChangeStockVendorFulfilledDTO
  // ) {
  //   return await c.var.trx
  //     .updateTable("ws_stocks")
  //     .set(req)
  //     .where("id", "=", id)
  //     .where("deleted_at", "is", null)
  //     .executeTakeFirst()
  // } *noted same function as updateStockVendorCustomerFulfilledById

  // async updateStockCustomerFulfilledById(
  //   c: Context,
  //   id: number,
  //   req: ChangeStockCustomerFulfilledDTO
  // ) {
  //   return await c.var.trx
  //     .updateTable("ws_stocks")
  //     .set(req)
  //     .where("id", "=", id)
  //     .where("deleted_at", "is", null)
  //     .executeTakeFirst()
  // } *noted same function as updateStockVendorCustomerFulfi lledById

  async createStockCustomerFulfilled(
    c: Context,
    req: AddStockCustomerFulfilledDTO
  ) {
    return await c.var.trx
      .insertInto("ws_stocks")
      .values(req)
      .executeTakeFirst()
  }

  async createTransactionFulfilled(
    c: Context,
    req: AddTransactionFulfilledDTO
  ) {
    return await c.var.trx
      .insertInto("ws_transactions")
      .values(req)
      .executeTakeFirst()
  }

  async getStockByIds(c: Context, id: number[]) {
    return await c.var.trx
      .selectFrom("ws_stocks as ws")
      .leftJoin("ws_batches as wb", (join) =>
        join.onRef("ws.batch_id", "=", "wb.id").on("wb.deleted_at", "is", null)
      )
      .forUpdate()
      .select([
        "ws.id as id",
        "ws.qty",
        "ws.in_transit_qty",
        "ws.entity_id",
        "ws.activity_id",
        "ws.material_id",
        "ws.batch_id",
        "wb.code as batch_code",
        "ws.budget_source_id",
        "ws.year",
        "ws.price",
        "ws.unreceived_qty",
      ])
      .where("ws.id", "in", id)
      .where("ws.deleted_at", "is", null)
      .execute()
  }

  async getStockCustomerByBatchId(
    c: Context,
    entityId: number | null,
    activityId: number,
    materialId: number,
    batchId: number | null
  ) {
    return await c.var.trx
      .selectFrom("ws_stocks")
      .forUpdate()
      .selectAll()
      .where("entity_id", "=", entityId)
      .where("activity_id", "=", activityId)
      .where("material_id", "=", materialId)
      .$if(batchId === null, (b) => b.where("batch_id", "is", null))
      .$if(batchId !== null, (b) => b.where("batch_id", "=", batchId))
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

  async getOrderAuditByOrderId(c: Context, orderId: number) {
    const result = await c.var.trx
      .selectFrom("ws_order_audits")
      .selectAll()
      .where("order_id", "=", orderId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async updateStockVendorCustomerFulfilledById(
    c: Context,
    id: number,
    req: ChangeStockVendorCustomerFulfilledDTO
  ) {
    return await c.var.trx
      .updateTable("ws_stocks")
      .set(req)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
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

  async getOrderItemStockByStockId(
    c: Context,
    orderId: number,
    stockId: number
  ) {
    const result = await c.var.trx
      .selectFrom("ws_order_item_stocks")
      .selectAll()
      .where("order_id", "=", orderId)
      .where("stock_id", "=", stockId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
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

  async createPurchaseShip(c: Context, req: AddPurchaseFulfillDTO) {
    return await c.var.trx
      .insertInto("ws_purchases")
      .values(req)
      .executeTakeFirst()
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

  async getWsEntityActivityByEntityActivityId(
    c: Context,
    entityId: number,
    activityId: number,
    currentDate: Date
  ) {
    return await c.var.trx
      .selectFrom("ws_entity_activities")
      .select(["id"])
      .where("entity_id", "=", entityId)
      .where("activity_id", "=", activityId)
      .where((eb) =>
        eb.or([eb("end_date", ">=", currentDate), eb("end_date", "is", null)])
      )
      .where("start_date", "<=", currentDate)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }
}
