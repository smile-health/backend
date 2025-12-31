import { BaseRepository } from "../base.repository.js"
import { Context } from "hono"
import {
  AddOrderItemStockReturnDTO,
  AddOrderHistoryReturnDTO,
  AddOrderAuditReturnDTO,
  AddOrderCommentReturnDTO,
  ChangeStockReturnDTO,
} from "./order-return.schema.js"

export class OrderReturnRepository extends BaseRepository<"ws_orders"> {
  constructor(filterProgram = false, filterActivity = false) {
    super("ws_orders", filterProgram, filterActivity)
  }

  async createOrderItemStockReturn(
    c: Context,
    req: AddOrderItemStockReturnDTO
  ) {
    return await c.var.trx
      .insertInto("ws_order_item_stocks")
      .values(req)
      .executeTakeFirst()
  }

  async createOrderHistoryReturn(c: Context, req: AddOrderHistoryReturnDTO) {
    return await c.var.trx
      .insertInto("ws_order_histories")
      .values(req)
      .executeTakeFirst()
  }

  async createOrderAuditReturn(c: Context, req: AddOrderAuditReturnDTO) {
    return await c.var.trx
      .insertInto("ws_order_audits")
      .values(req)
      .executeTakeFirst()
  }

  async createOrderCommentReturn(c: Context, req: AddOrderCommentReturnDTO) {
    return await c.var.trx
      .insertInto("ws_order_comments")
      .values(req)
      .executeTakeFirst()
  }

  async getStockByIds(c: Context, id: number[]) {
    return await c.var.trx
      .selectFrom("ws_stocks as wss")
      .forUpdate()
      .selectAll()
      .where("wss.id", "in", id)
      .where("wss.deleted_at", "is", null)
      .execute()
  }

  async updateStockReturnById(
    c: Context,
    id: number,
    req: ChangeStockReturnDTO
  ) {
    return await c.var.trx
      .updateTable("ws_stocks")
      .set(req)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getEntityById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getVendorListByCustomerId(
    c: Context,
    customerId: number,
    programId: number
  ) {
    const query = c.var.trx
      .with("vendors", (db) =>
        db
          .selectFrom("ws_entities as e")
          .innerJoin("ws_customer_vendors as cv", (join) =>
            join
              .onRef("cv.customer_id", "=", "e.id")
              .on("cv.deleted_at", "is", null)
              .on("cv.program_id", "=", programId)
          )
          .where("cv.customer_id", "=", customerId)
          .where("e.status", "=", 1)
          .where("e.deleted_at", "is", null)
          .where("e.program_id", "=", programId)
          .select(["cv.vendor_id as vendor_id"])
      )
      .selectFrom("vendors as v")
      .innerJoin("ws_entities as e", (join) =>
        join
          .onRef("e.id", "=", "v.vendor_id")
          .on("e.deleted_at", "is", null)
          .on("e.status", "=", 1)
          .on("e.program_id", "=", programId)
      )
      .select(["v.vendor_id as id"])
      .execute()

    return query
  }

  async getActivityById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_activities")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
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
}
