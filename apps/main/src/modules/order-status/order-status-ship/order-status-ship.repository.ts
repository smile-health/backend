import { BaseRepository } from "../../base.repository.js"
import { Context } from "hono"
import {
  AddOrderHistoryShipDTO,
  UpdateOrderAuditShipDTO,
  AddOrderCommentShipDTO,
  ChangeStockShipDTO,
  AddTransactionShipDTO,
  AddPurchaseShipDTO,
  AddStockCustomerShipDTO,
} from "./order-status-ship.schema.js"

export class OrderStatusShipRepository extends BaseRepository<"ws_orders"> {
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
          .on("wois.deleted_at", "is", null)
          .on("wois.order_id", "=", orderId)
      )
      .innerJoin("ws_materials as wm", (join) =>
        join
          .onRef("ws.material_id", "=", "wm.id")
          .on("wm.deleted_at", "is", null)
      )
      .leftJoin("materials as mp", (join) =>
        join.onRef("wm.parent_global_id", "=", "mp.id")
      )
      .leftJoin("ws_batches as wb", (join) =>
        join.onRef("ws.batch_id", "=", "wb.id").on("wb.deleted_at", "is", null)
      )
      .forUpdate()
      .select([
        "wois.id",
        "ws.id as stock_id",
        "ws.qty as stock_qty",
        "ws.allocated_qty as stock_allocated_qty",
        "ws.in_transit_qty as stock_in_transit_qty",
        "ws.activity_id as stock_activity_id",
        "ws.entity_id as stock_entity_id",
        "wois.allocated_qty as item_stock_allocated_qty",
        "wb.code as batch_code",
        "wb.manufacture_id",
        "ws.budget_source_id",
        "ws.year",
        "ws.price",
        "ws.batch_id",
        "ws.material_id as stock_material_id",
        "ws.parent_material_id",
        "wm.name as stock_material_name",
        "wm.unit_of_consumption as stock_material_unit_of_consumption",
      ])
      .where("ws.deleted_at", "is", null)
      .where("mp.deleted_at", "is", null) // check parent material not deleted, handle duplicate ws_materials
      .execute()
  }

  async createOrderHistoryShip(c: Context, req: AddOrderHistoryShipDTO) {
    return await c.var.trx
      .insertInto("ws_order_histories")
      .values(req)
      .executeTakeFirst()
  }

  async updateOrderAuditShipByOrderId(
    c: Context,
    orderId: number,
    req: UpdateOrderAuditShipDTO
  ) {
    const result = await c.var.trx
      .updateTable("ws_order_audits")
      .set(req)
      .where("order_id", "=", orderId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
    return result
  }

  async updateOrderItemStock(c: Context, id: number, req: any) {
    return await c.var.trx
      .updateTable("ws_order_item_stocks")
      .set(req)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async createOrderCommentShip(c: Context, req: AddOrderCommentShipDTO) {
    return await c.var.trx
      .insertInto("ws_order_comments")
      .values(req)
      .executeTakeFirst()
  }

  async updateStockShip(c: Context, id: number, req: ChangeStockShipDTO) {
    return await c.var.trx
      .updateTable("ws_stocks")
      .set(req)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async createTransactionShip(c: Context, req: AddTransactionShipDTO) {
    return await c.var.trx
      .insertInto("ws_transactions")
      .values(req)
      .executeTakeFirst()
  }

  async getDetailOrderItemByOrderId(c: Context, orderId: number) {
    const result = await c.var.trx
      .selectFrom("ws_orders as wso")
      .innerJoin("ws_order_comments as woc", (join) =>
        join
          .onRef("woc.order_id", "=", "wso.id")
          .on("woc.deleted_at", "is", null)
      )
      .innerJoin("ws_order_audits as wsoa", (join) =>
        join
          .onRef("wsoa.order_id", "=", "wso.id")
          .on("wsoa.deleted_at", "is", null)
      )
      .select([
        "woc.id",
        "woc.order_id",
        "wso.sales_ref",
        "wso.taken_by_customer",
        "wsoa.estimated_date",
        "woc.comment",
        "woc.created_at",
      ])
      .where("wso.id", "=", orderId)
      .where("wso.deleted_at", "is", null)
      .execute()

    return result
  }

  async createPurchaseShip(c: Context, req: AddPurchaseShipDTO) {
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

  async createStockCustomerShip(c: Context, req: AddStockCustomerShipDTO) {
    return await c.var.trx
      .insertInto("ws_stocks")
      .values(req)
      .executeTakeFirst()
  }

  async getWsUsersByEntityId(c: Context, entityId: number, programId: number) {
    console.log(entityId, programId)
    return await c.var.trx
      .selectFrom("ws_users")
      .selectAll()
      .where("entity_id", "=", entityId)
      .where("program_id", "=", programId)
      .where("status", "=", 1)
      .where("role", "not in", [1, 2])
      .execute()
  }

  async getWsEntitiesByIds(c: Context, ids: number[], programId: number) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .select(["id", "name", "entity_tag_id", "province_id", "regency_id"])
      .where("id", "in", ids)
      .where("program_id", "=", programId)
      .execute()
  }

  async getWsActivitiesById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_activities")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .executeTakeFirst()
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
      .executeTakeFirst()
  }
}
