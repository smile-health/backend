import { Context } from "hono"

import { StockLoggingRepository } from "./stock-logging.repository.js"
import { StockRepository } from "../stock/stock.repository.js"
import { TRANSACTION_TYPE } from "@/common/constants/transaction.js"

export class StockLoggingModule {
  constructor(
    private readonly repository: StockLoggingRepository,
    private readonly stockRepo: StockRepository
  ) {}

  async getStockActivedMalariaMbs(c: Context, page: number, limit: number) {
    const data = await this.repository.getStockActivedMalariaMbs(c, page, limit)

    return data
  }

  async notPadanan(c: Context, page: number, limit: number) {
    const data = await this.repository.getStockNotPadanan(c, page, limit)

    return data
  }

  async getDetailStockById(c: Context, id: any) {
    const data = await this.repository.getDetailStockById(c, id)

    return data
  }

  async reduceStock(c: Context, body: any) {
    const startTime = Date.now() // Track execution time

    for (const item of body) {
      const itemStartTime = Date.now()

      //  Initialize log data structure matching DDL
      let logData: any = {
        // Remove operation fields (Malaria-MBS)
        transaction_id_remove: null,
        stock_id_mbs: item.stock_id,
        batch_id_mbs: null,
        material_id_mbs: null,
        entity_id_mbs: null,
        manufacture_id_mbs: null,
        qty_mbs: item.qty,
        budget_source_id_mbs: null,
        exterminate_qty_mbs: null,
        open_vial_qty_mbs: null,
        year_mbs: null,
        price_mbs: null,
        total_price_mbs: null,

        // Status and message
        status: "success",
        message: null,

        // Add operation fields (Malaria-Rutin) - null for reduce operation
        transaction_id_add: null,
        stock_id_malaria: null,
        batch_id_malaria: null,
        material_id_malaria: null,
        entity_id_malaria: null,
        manufacture_id_malaria: null,
        qty_malaria: null,
        budget_source_id_malaria: null,
        exterminate_qty_malaria: null,
        open_vial_qty_malaria: null,
        year_malaria: null,
        price_malaria: null,
        total_price_malaria: null,
      }

      try {
        // Validation for Zero/Negative Input (Scenario 4)
        if (item.qty <= 0) {
          await this.repository.createStockAdjustLog(c, {
            ...logData,
            status: "failed",
            message: `Invalid reduction amount: ${item.qty}. Amount must be greater than 0`,
          })
          console.log(`Skipped stock ${item.stock_id}: Invalid qty ${item.qty}`)
          continue // Skip this item
        }

        const stock: any = await this.repository.getStockId(c, item.stock_id)

        if (!stock) {
          await this.repository.createStockAdjustLog(c, {
            ...logData,
            status: "skipped",
            message: `Stock with id ${item.stock_id} not found`,
          })
          console.log(`Skipped: Stock with id ${item.stock_id} not found`)
          continue // Skip this item, don't throw error
        }

        // Update log data with complete stock information for MBS (source)
        logData = {
          ...logData,
          stock_id_mbs: stock.id,
          batch_id_mbs: stock.batch_id,
          material_id_mbs: stock.material_id,
          entity_id_mbs: stock.entity_id,
          manufacture_id_mbs: stock.manufacture_id,
          qty_mbs: item.qty, // Quantity being reduced
          budget_source_id_mbs: stock.budget_source_id,
          exterminate_qty_mbs: stock.exterminated_qty ?? null,
          open_vial_qty_mbs: stock.open_vial_qty,
          year_mbs: stock.year,
          price_mbs: stock.price,
          total_price_mbs: stock.total_price,
        }

        // Check if stock quantity > 0 (Scenario 2)
        if (stock.qty <= 0) {
          await this.repository.createStockAdjustLog(c, {
            ...logData,
            status: "skipped",
            message: `Stock quantity is ${stock.qty}, no reduction needed`,
          })
          console.log(`Skipped stock ${item.stock_id}: qty is ${stock.qty}`)
          continue
        }

        //  Validation for Exceeding Available Quantity (Scenario 3)
        if (item.qty > stock.qty) {
          await this.repository.createStockAdjustLog(c, {
            ...logData,
            status: "failed",
            message: `Cannot reduce ${item.qty} from stock with quantity ${stock.qty}. Insufficient stock.`,
          })
          console.log(
            `Failed stock ${item.stock_id}: Insufficient stock. Requested: ${item.qty}, Available: ${stock.qty}`
          )
          continue // Don't throw error, just log and continue
        }

        //  Perform stock reduction
        const newQty = stock.qty - item.qty
        console.log({ stock1: stock.qty, qtyQuery: item.qty })
        // await this.stockRepo.update(c, { qty: newQty }, { id: item.stock_id })
        await this.repository.updateStockQty(c, item.stock_id, newQty)

        //  Create transaction log
        const transactionRemove = await this.repository.createWsTransaction(c, {
          stock_id: item.stock_id,
          entity_id: item.entity_id,
          entity_activity_id: item.entity_activity_id,
          batch_code: item.batch_code ?? null,
          activity_id: item.activity_id,
          order_id: null,
          change_qty: -item.qty, // Negative for reduction
          opening_qty: stock.qty,
          transaction_type_id: TRANSACTION_TYPE.REMOVE_STOCK,
          transaction_reason_id: 18,
          created_at: new Date(),
          created_by: c.var.userId,
          updated_at: new Date(),
          status: 1,
          transaction_companion: null,
        })

        //  Log successful operation with complete information
        const executionTime = Date.now() - itemStartTime
        await this.repository.createStockAdjustLog(c, {
          ...logData,
          transaction_id_remove: transactionRemove?.insertId ?? null,
          status: "success",
          message: `Stock reduced successfully from ${stock.qty} to ${newQty}`,
        })

        console.log(
          `Successfully reduced stock ${item.stock_id} from ${stock.qty} to ${newQty} in ${executionTime}ms`
        )
      } catch (error: any) {
        //  Handle unexpected errors with proper logging
        console.log({ error })
        const executionTime = Date.now() - itemStartTime
        await this.repository.createStockAdjustLog(c, {
          ...logData,
          status: "failed",
          message: `Error during stock reduction: ${error?.message || "Unknown error"}`,
        })

        console.error(
          `Error reducing stock ${item.stock_id} (${executionTime}ms):`,
          error
        )
        // Don't throw, continue with next item
      }
    }

    const totalExecutionTime = Date.now() - startTime
    console.log(`Total stock reduction execution time: ${totalExecutionTime}ms`)
  }

  async addStock(c: Context, body: any) {
    const startTime = Date.now()
    const MALARIA_RUTIN_ACTIVITY_ID = 1 // Konstanta untuk Malaria-Rutin

    let processedCount = 0
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    for (const [index, item] of body.entries()) {
      const itemStartTime = Date.now()

      // Initialize complete log data structure - all MBS fields null for addStock
      const logData = {
        // MBS fields (source data) - null for addStock operation
        transaction_id_remove: null,
        stock_id_mbs: null,
        batch_id_mbs: null,
        material_id_mbs: null,
        entity_id_mbs: null,
        manufacture_id_mbs: null,
        qty_mbs: null,
        budget_source_id_mbs: null,
        exterminate_qty_mbs: null,
        open_vial_qty_mbs: null,
        year_mbs: null,
        price_mbs: null,
        total_price_mbs: null,

        // Malaria fields (destination) - akan diisi setelah processing
        transaction_id_add: null,
        stock_id_malaria: null,
        batch_id_malaria: null,
        material_id_malaria: null,
        entity_id_malaria: null,
        manufacture_id_malaria: null,
        qty_malaria: null,
        budget_source_id_malaria: null,
        exterminate_qty_malaria: null,
        open_vial_qty_malaria: null,
        year_malaria: null,
        price_malaria: null,
        total_price_malaria: null,

        status: "success",
        message: null,
      }

      try {
        processedCount++

        //  SCENARIO 3: Activity Validation
        if (item.activity_id !== MALARIA_RUTIN_ACTIVITY_ID) {
          await this.repository.createStockAdjustLog(c, {
            ...logData,
            status: "skipped",
            message: `Skipped: Only Malaria-Rutin activity allowed, got activity_id: ${item.activity_id}`,
          })
          skippedCount++
          console.log(
            `Skipped item ${index}: Wrong activity_id ${item.activity_id}`
          )
          continue
        }

        //  SCENARIO 4: Quantity Validation
        if (!item.qty || item.qty <= 0) {
          await this.repository.createStockAdjustLog(c, {
            ...logData,
            status: "skipped",
            message: `Data dilewati karena qty tidak valid: ${item.qty}`,
          })
          skippedCount++
          console.log(`Skipped item ${index}: Invalid qty ${item.qty}`)
          continue
        }

        // Get existing stock by stock_id (skip find/create logic as requested)
        // const stock = await this.stockRepo.findOne(c, { id: item.stock_id })
        const stock: any = await this.repository.getStockId(c, item.stock_id)
        const checkLogTrx: any =
          await this.repository.checkTransactionExistInLog(c, item.stock_id)

        if (!stock) {
          await this.repository.createStockAdjustLog(c, {
            ...logData,
            status: "failed",
            message: `Stock with id ${item.stock_id} not found`,
          })
          failedCount++
          console.log(`Failed item ${index}: Stock ${item.stock_id} not found`)
          continue
        }

        if (checkLogTrx === true) {
          await this.repository.createStockAdjustLog(c, {
            ...logData,
            status: "skipped",
            message: `Skipped: Transaction log already exists for stock_id_malaria: ${item.stock_id}`,
          })
          skippedCount++
          console.log(
            `Skipped item ${index}: Transaction log already exists for stock_id_malaria: ${item.stock_id}`
          )
          continue
          // Handle existing transaction log
        }

        // Add to existing stock
        const originalQty = stock.qty
        const newQty = stock.qty + item.qty
        console.log({ stock1: stock.qty, qtyQuery: item.qty })
        // await this.stockRepo.update(c, { qty: newQty }, { id: item.stock_id })
        await this.repository.updateStockQty(c, item.stock_id, newQty)

        //  Create transaction log with correct change_qty
        const transactionAdd = await this.repository.createWsTransaction(c, {
          stock_id: item.stock_id,
          entity_id: item.entity_id,
          entity_activity_id: item.entity_activity_id,
          batch_code: item.batch_code ?? null,
          activity_id: item.activity_id,
          order_id: null,
          change_qty: item.qty, //  FIXED: Addition amount, not total
          opening_qty: originalQty,
          transaction_type_id: TRANSACTION_TYPE.ADD_STOCK,
          transaction_reason_id: 22,
          created_at: new Date(),
          created_by: c.var.userId,
          updated_at: new Date(),
          status: 1,
          transaction_companion: null,
        })

        await this.repository.createPurchaseNew(c, {
          // stock_id: item.stock_id,
          source_id: transactionAdd?.insertId ?? null,
          source_type: "transaction",
          budget_source_id: stock.budget_source_id,
          price: stock.price,
          total_price: stock.price,
          year: stock.year,
          created_at: new Date(),
          created_by: c.var.userId,
          updated_at: new Date(),
          updated_by: c.var.userId,
          deleted_at: null,
          deleted_by: null,
        })

        //  SCENARIO 5: Complete logging with all fields
        const executionTime = Date.now() - itemStartTime
        await this.repository.createStockAdjustLog(c, {
          ...logData,
          transaction_id_add: transactionAdd?.insertId ?? null,
          stock_id_malaria: stock.id,
          batch_id_malaria: stock.batch_id,
          material_id_malaria: stock.material_id,
          entity_id_malaria: stock.entity_id,
          manufacture_id_malaria: stock.manufacture_id,
          qty_malaria: newQty, // Final quantity after addition
          budget_source_id_malaria: stock.budget_source_id,
          exterminate_qty_malaria: stock.exterminated_qty ?? null,
          open_vial_qty_malaria: stock.open_vial_qty,
          year_malaria: stock.year,
          price_malaria: stock.price,
          total_price_malaria: stock.total_price,
          status: "success",
          message: `Stock quantity increased from ${originalQty} to ${newQty}`,
        })

        successCount++
        console.log(
          ` Stock ${item.stock_id} increased from ${originalQty} to ${newQty} in ${executionTime}ms`
        )
      } catch (error: any) {
        //  Proper error handling
        const executionTime = Date.now() - itemStartTime
        await this.repository.createStockAdjustLog(c, {
          ...logData,
          status: "failed",
          message: `Error during stock addition: ${error?.message || "Unknown error"}`,
        })

        failedCount++
        console.error(
          `❌ Error processing stock item ${index} (${executionTime}ms):`,
          error
        )
        // Continue with next item, don't throw
      }
    }

    //  SCENARIO 7: Process completion status
    const totalExecutionTime = Date.now() - startTime
    const overallStatus =
      failedCount > 0 ? "failed" : successCount > 0 ? "successful" : "skipped"

    return {
      status: overallStatus,
      totalProcessed: processedCount,
      successful: successCount,
      failed: failedCount,
      skipped: skippedCount,
      executionTime: totalExecutionTime,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date().toISOString(),
    }
  }

  async addStockTanpaPadanan(c: Context, body: any) {
    const startTime = Date.now()
    const MALARIA_RUTIN_ACTIVITY_ID = 1 // Auto set ke 1

    let processedCount = 0
    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    for (const [index, item] of body.entries()) {
      const itemStartTime = Date.now()

      // Complete log data structure - all MBS fields null for addStockTanpaPadanan
      const logData = {
        // MBS fields (source data) - null for addStockTanpaPadanan operation
        transaction_id_remove: null,
        stock_id_mbs: null,
        batch_id_mbs: null,
        material_id_mbs: null,
        entity_id_mbs: null,
        manufacture_id_mbs: null,
        qty_mbs: null,
        budget_source_id_mbs: null,
        exterminate_qty_mbs: null,
        open_vial_qty_mbs: null,
        year_mbs: null,
        price_mbs: null,
        total_price_mbs: null,

        // Malaria fields - will be populated after stock creation
        transaction_id_add: null,
        stock_id_malaria: null,
        batch_id_malaria: null,
        material_id_malaria: null,
        entity_id_malaria: null,
        manufacture_id_malaria: null,
        qty_malaria: null,
        budget_source_id_malaria: null,
        exterminate_qty_malaria: null,
        open_vial_qty_malaria: null,
        year_malaria: null,
        price_malaria: null,
        total_price_malaria: null,

        status: "success",
        message: null,
      }

      try {
        processedCount++

        //  Quantity Validation (sama seperti addStock)
        if (!item.qty || item.qty <= 0) {
          await this.repository.createStockAdjustLog(c, {
            ...logData,
            status: "skipped",
            message: `Data dilewati karena qty tidak valid: ${item.qty}`,
          })
          skippedCount++
          continue
        }

        const checkTrxExistInLogWithMessage =
          await this.repository.checkTransactionExistInLogWithMessage(
            c,
            item.stock_id
          )

        if (checkTrxExistInLogWithMessage) {
          await this.repository.createStockAdjustLog(c, {
            ...logData,
            status: "skipped",
            message: `Data dilewati karena sudah ada di log untuk mbs_stok_id: ${item.stock_id}`,
          })
          skippedCount++
          continue
        }

        // Create new stock (yang berbeda dari addStock)
        const newStockId = await this.repository.createNewStock(c, {
          batch_id: item.batch_id,
          material_id: item.material_id,
          entity_id: item.entity_id,
          activity_id: MALARIA_RUTIN_ACTIVITY_ID, //  Auto set ke 1
          manufacture_id: item.manufacture_id,
          qty: item.qty,
          budget_source_id: item.budget_source_id,
          price: item.price,
          total_price: item.price * item.qty,
          year: item.year,
          open_vial_qty: item.open_vial_qty || 0,
          exterminated_qty: item.exterminated_qty || 0,
          created_at: new Date(),
          created_by: c.var.userId,
          updated_at: new Date(),
          updated_by: c.var.userId,
        })

        //  Get created stock for logging
        const createdStock = await this.stockRepo.findOne(c, { id: newStockId })

        //  Create transaction
        const transactionAdd = await this.repository.createWsTransaction(c, {
          stock_id: newStockId, // Use newStockId
          entity_id: item.entity_id,
          entity_activity_id: item.entity_activity_id,
          batch_code: item.batch_code ?? null,
          activity_id: MALARIA_RUTIN_ACTIVITY_ID,
          order_id: null,
          change_qty: item.qty, //  Correct: addition amount
          opening_qty: 0, //  New stock starts from 0
          transaction_type_id: TRANSACTION_TYPE.ADD_STOCK,
          transaction_reason_id: 22,
          created_at: new Date(),
          created_by: c.var.userId,
          updated_at: new Date(),
          status: 1,
          transaction_companion: null,
        })

        //  Create purchase record
        await this.repository.createPurchaseNew(c, {
          // stock_id: newStockId,
          source_id: transactionAdd?.insertId ?? null,
          source_type: "transaction",
          budget_source_id: item.budget_source_id,
          price: item.price,
          total_price: item.price * item.qty, //  Fixed calculation
          year: item.year,
          created_at: new Date(),
          created_by: c.var.userId,
          updated_at: new Date(),
          updated_by: c.var.userId,
          deleted_at: null,
          deleted_by: null,
        })

        //  Complete logging
        await this.repository.createStockAdjustLog(c, {
          ...logData,
          transaction_id_add: transactionAdd?.insertId ?? null,
          stock_id_malaria: newStockId, //  Fixed: use newStockId
          batch_id_malaria: createdStock?.batch_id,
          material_id_malaria: createdStock?.material_id,
          entity_id_malaria: createdStock?.entity_id,
          manufacture_id_malaria: createdStock?.manufacture_id,
          qty_malaria: item.qty,
          budget_source_id_malaria: item.budget_source_id,
          exterminate_qty_malaria: item.exterminated_qty || 0,
          open_vial_qty_malaria: item.open_vial_qty || 0,
          year_malaria: item.year,
          price_malaria: item.price,
          total_price_malaria: item.price * item.qty,
          status: "success",
          message: `New stock created with ID ${newStockId} and quantity ${item.qty} from stock_id ${item.stock_id}`,
        })

        successCount++
      } catch (error: any) {
        //  Error handling (same as addStock)
        await this.repository.createStockAdjustLog(c, {
          ...logData,
          status: "failed",
          message: `Error creating new stock: ${error?.message || "Unknown error"}`,
        })
        failedCount++
        // Continue, don't throw
      }
    }

    //  Process completion (same as addStock)
    const totalExecutionTime = Date.now() - startTime
    const overallStatus =
      failedCount > 0 ? "failed" : successCount > 0 ? "successful" : "skipped"

    console.log(`🎯 addStockTanpaPadanan Process Complete: ...`)

    return {
      /* same return structure as addStock */
    }
  }

  async testcreateStockAdjustLog(c: Context, data: any) {
    const result = await this.repository.createStockAdjustLog(c, data)

    return result
  }
  async testCreateTrx(c: Context, data: any) {
    const result = await this.repository.createWsTransaction(c, data)

    return result
  }

  async testCreatePurchase(c: Context, data: any) {
    const result = await this.repository.createPurchaseNew(c, data)

    return result
  }

  async testCreateStock(c: Context, data: any) {
    const result = await this.stockRepo.create(c, data)

    return result
  }

  async testGetStockById(c: Context, id: number) {
    const result = await this.repository.getStockId(c, id)

    return result
  }

  async testCheckStockInLog(c: Context, id: number) {
    const result = await this.repository.checkTransactionExistInLog(c, id)

    return result
  }
}
