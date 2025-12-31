import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { StockLoggingModule } from "./stock-logging.module.js"

export class StockLoggingController extends BaseController {
  constructor(private module: StockLoggingModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/",

      // this.validateRequest("query", GetListStockConsumptionSchema),
      async (c) => {
        const page = c.req.query("page") || 1
        const limit = c.req.query("limit") || 10
        /**
         * type = all | padanan | non-padanan
         */
        const type = c.req.query("type") || "all"

        let reduceStock
        let addStock
        let reduceStockNotPadanan
        let stockNonPadanan

        if (type === "padanan" || type === "all") {
          const stockActivedMalariaMbs: any =
            await this.module.getStockActivedMalariaMbs(
              c,
              Number(page),
              Number(limit)
            )

          // Remove duplicates by stock_id (keep first occurrence only)
          const stockMap = new Map()

          stockActivedMalariaMbs.forEach((item) => {
            const stockId = item.mbs_stock_id
            if (!stockMap.has(stockId)) {
              // Add new stock entry only if not already exists
              stockMap.set(stockId, {
                stock_id: item.mbs_stock_id,
                qty: item.mbs_qty,
                entity_id: item.entity_id,
                entity_activity_id: item.mbs_ea_id,
                material_id: item.material_id,
                batch_id: item.batch_id,
                batch_code: item.batch_code,
                activity_id: item.activity_id,
                manufacture_id: item.manufacture_id,
              })
            }
          })

          // Convert Map to Array for processing
          reduceStock = Array.from(stockMap.values())

          console.log(
            `Original items: ${stockActivedMalariaMbs.length}, After deduplication: ${reduceStock.length}`
          )

          await this.module.reduceStock(c, reduceStock)

          // Remove duplicates by stock_id for add stock (keep first occurrence only)
          const addStockMap = new Map()

          stockActivedMalariaMbs.forEach((item) => {
            const stockId = item.rutin_stock_id
            if (!addStockMap.has(stockId)) {
              // Add new stock entry only if not already exists
              addStockMap.set(stockId, {
                stock_id: item.rutin_stock_id,
                qty: item.mbs_qty,
                entity_id: item.entity_id,
                entity_activity_id: item.rutin_wea_id,
                material_id: item.material_id,
                batch_id: item.batch_id,
                batch_code: item.batch_code,
                manufacture_id: item.manufacture_id,
                activity_id: item.activity_id,
              })
            }
          })

          // Convert Map to Array for processing
          addStock = Array.from(addStockMap.values())

          console.log(
            `Add stock - Original items: ${stockActivedMalariaMbs.length}, After deduplication: ${addStock.length}`
          )

          await this.module.addStock(c, addStock)
        }

        /**
         * stock tanpa pandanan
         */
        if (type === "non-padanan" || type === "all") {
          stockNonPadanan = await this.module.notPadanan(
            c,
            Number(page),
            Number(limit)
          )
          // Remove duplicates by stock_id for non-padanan reduce stock (keep first occurrence only)
          const reduceStockNotPadananMap = new Map()

          stockNonPadanan.forEach((item) => {
            const stockId = item.mbs_stock_id
            if (!reduceStockNotPadananMap.has(stockId)) {
              // Add new stock entry only if not already exists
              reduceStockNotPadananMap.set(stockId, {
                stock_id: item.mbs_stock_id,
                qty: item.mbs_qty,
                entity_id: item.entity_id,
                entity_activity_id: item.mbs_ea_id,
                material_id: item.material_id,
                batch_id: item.batch_id,
                batch_code: item.batch_code,
                activity_id: item.activity_id,
                manufacture_id: item.manufacture_id,
                budget_source_id: item.budget_source_id,
                price: item.price,
                total_price: item.total_price,
                year: item.year,
              })
            }
          })

          // Convert Map to Array for processing
          reduceStockNotPadanan = Array.from(reduceStockNotPadananMap.values())

          console.log(
            `Reduce stock non-padanan - Original items: ${stockNonPadanan.length}, After deduplication: ${reduceStockNotPadanan.length}`
          )

          await this.module.reduceStock(c, reduceStockNotPadanan)
          await this.module.addStockTanpaPadanan(c, reduceStockNotPadanan)
        }

        return c.json(
          {
            message: "Stock migration completed successfully",
          },
          StatusCodes.OK
        )
      }
    )

    router.get("/test-create-adjust-log", async (c) => {
      try {
        let result = await this.module.testCheckStockInLog(c, 20262)

        return c.json({ data: result }, StatusCodes.OK)
      } catch (error) {
        console.log(error)
      }
    })

    return router
  }
}
