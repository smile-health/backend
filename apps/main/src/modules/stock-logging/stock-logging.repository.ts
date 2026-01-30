import { db } from "@/common/infrastructure/database/index.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { CompiledQuery } from "kysely"

const databaseLogging = process.env.PROD_DB_DATABASE || "smile5"
export class StockLoggingRepository {
  async getStockActivedMalariaMbs(c: Context<DB>, page: number, limit: number) {
    const { rows } = await db.executeQuery(
      /**
       *  Memastikan stok yang masih aktif pada Malaria-MBS juga memiliki stok_id atau EMMA pada Malaria-Rutin
       */

      CompiledQuery.raw(`
          with a AS (
            select
              ws.id,
              wea.id as ea_id,
              ws.entity_id,
              ws.material_id,
              ws.batch_id,
              ws.batch_code,
              ws.manufacture_id,
              ws.activity_id,
              ws.qty
            from
              ${databaseLogging}.ws_stocks ws
            join ${databaseLogging}.ws_entity_activities wea on
              ws.entity_id = wea.entity_id
              and ws.activity_id = wea.activity_id
            where
              ws.deleted_at is null
              and ws.activity_id = 2
              and ws.qty > 0 
            )
            SELECT
              a.id as mbs_stock_id,
              a.entity_id,
              a.ea_id as mbs_ea_id,
              a.material_id,
              a.batch_id,
              a.batch_code,
              a.activity_id,
              a.qty as mbs_qty,
              ws.id as rutin_stock_id,
              ws.entity_id,
              wea.id as rutin_wea_id,
              ws.material_id,
              ws.batch_id,
              ws.batch_code,
              ws.manufacture_id,
              ws.activity_id,
              ws.qty as rutin_qty
            from
              a
            join ${databaseLogging}.ws_stocks ws on
              a.entity_id = ws.entity_id
            join ${databaseLogging}.ws_entity_activities wea on
              ws.entity_id = wea.entity_id
              and ws.activity_id = wea.activity_id
              and a.batch_id = ws.batch_id
              and a.batch_code = ws.batch_code
              and a.material_id = ws.material_id
              -- and a.manufacture_id = ws.manufacture_id
              and ws.activity_id = 1
            where
              ws.deleted_at is null
              -- and ws.id is null
            LIMIT ${limit} OFFSET ${(page - 1) * limit}
        `)
    )
    return rows
  }

  async getStockNotPadanan(c: Context<DB>, page: number, limit: number) {
    const { rows } = await db.executeQuery(
      /**
       * Malaria-MBS yang tidak memiliki padanan pada Malaria-Rutin
       */
      CompiledQuery.raw(`
       with a AS (
        select
          ws.id,
          wea.id as ea_id,
          ws.entity_id,
          ws.material_id,
          ws.batch_id,
          ws.batch_code,
          ws.manufacture_id,
          ws.budget_source_id,
          ws.activity_id,
          ws.total_price,
          ws.qty,
          ws.price,
          ws.year
        from
          ${databaseLogging}.ws_stocks ws
        join ${databaseLogging}.ws_entity_activities wea on
          ws.entity_id = wea.entity_id 
          and ws.activity_id = wea.activity_id
        where
          ws.deleted_at is null
          and ws.activity_id = 2
          and ws.qty > 0 
        )
        SELECT
          a.id as mbs_stock_id,
          a.entity_id,
          a.ea_id as mbs_ea_id,
          a.material_id,
          a.batch_id,
          a.batch_code,
          a.activity_id,
          a.qty as mbs_qty,
          a.budget_source_id,
          a.price,
          a.total_price,
          a.year,
          
          ws.id as rutin_stock_id,
          ws.entity_id as rutin_entity_id,
          -- wea.id as rutin_wea_id,
          ws.material_id as rutin_material_id,
          ws.batch_id as rutin_batch_id,
          ws.batch_code as rutin_batch_code,
          ws.manufacture_id as rutin_manufacture_id,
          ws.activity_id as rutin_activity_id,
          ws.qty as rutin_qty
          
        from
          a
        left join ${databaseLogging}.ws_stocks ws on
          a.entity_id = ws.entity_id
          and a.batch_id = ws.batch_id
          and a.batch_code = ws.batch_code
          and a.material_id = ws.material_id
          and ws.deleted_at is null
          and ws.activity_id = 1
        left join ${databaseLogging}.ws_entity_activities wea2 on
          ws.entity_id = wea2.entity_id
          and ws.activity_id = wea2.activity_id
        where
          ws.id is null
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
        `)
    )
    return rows
  }

  async getDetailStockById(c: Context<DB>, id: any) {
    const stockEd = await c.var.trx
      .selectFrom("ws_stocks as ws")
      .where("ws.id", "in", id)
      .selectAll("ws")
      .execute()
    return stockEd
  }

  async createWsTransaction(c: Context<DB>, data: any) {
    try {
      const result = await c.var.trx
        .insertInto("ws_transactions" as any)
        .values(data)
        .executeTakeFirstOrThrow()

      // Convert BigInt to number to avoid JSON serialization issues
      return {
        success: true,
        insertId: result?.insertId ? Number(result.insertId) : null,
        numInsertedOrUpdatedRows: result?.numInsertedOrUpdatedRows
          ? Number(result.numInsertedOrUpdatedRows)
          : 0,
      }
    } catch (error) {
      console.error("Error creating ws_transaction:", error)
      console.error("Data being inserted:", JSON.stringify(data, null, 2))
      throw error
    }
  }

  async createStockAdjustLog(c: Context<DB>, data: any) {
    try {
      const result = await c.var.trx
        .insertInto("stock_adjust_log" as any)
        .values(data)
        .executeTakeFirstOrThrow()

      // Convert BigInt to number to avoid JSON serialization issues
      return {
        success: true,
        insertId: result?.insertId ? Number(result.insertId) : null,
        numInsertedOrUpdatedRows: result?.numInsertedOrUpdatedRows
          ? Number(result.numInsertedOrUpdatedRows)
          : 0,
      }
    } catch (error) {
      console.error("Error creating stock adjust log:", error)
      console.error("Data being inserted:", JSON.stringify(data, null, 2))
      throw error
    }
  }

  async createNewStock(c: Context<DB>, data: any) {
    const result = await c.var.trx
      .insertInto("ws_stocks")
      .values(data)
      .executeTakeFirst()

    return Number(result?.insertId)
  }

  async createPurchaseNew(c: Context<DB>, data: any) {
    const result = await c.var.trx
      .insertInto("ws_purchases")
      .values(data)
      .executeTakeFirst()

    return Number(result?.insertId)
  }

  async updateStockQty(c: Context<DB>, stockId: number, newQty: number) {
    const result = await c.var.trx
      .updateTable("ws_stocks")
      .set({ qty: newQty })
      .where("id", "=", stockId)
      .executeTakeFirst()

    return result
  }

  async getStockId(c: Context<DB>, stockId: number) {
    const stock = await c.var.trx
      .selectFrom("ws_stocks as ws")
      .where("ws.id", "=", stockId)
      .selectAll("ws")
      .executeTakeFirst()

    return stock
  }

  async checkTransactionExistInLog(c: Context<DB>, stock_id: number) {
    const log = await c.var.trx
      .selectFrom("stock_adjust_log" as any)
      .where("stock_id_malaria", "=", stock_id)
      .where("status", "not in", ["failed"])
      .selectAll()
      .executeTakeFirst()

    return log ? true : false
  }

  async checkTransactionExistInLogWithMessage(
    c: Context<DB>,
    stock_id: number
  ) {
    const log = await c.var.trx
      .selectFrom("stock_adjust_log" as any)
      .where("message", "like", `%from stock_id ${stock_id}%`)
      .selectAll()
      .executeTakeFirst()

    return log ? true : false
  }
}
