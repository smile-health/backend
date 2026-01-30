import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { StockMiddleware } from "./stock.middleware.js"
import { StockModule } from "./stock.module.js"
import {
  GetEntityStocksQueriesSchema,
  GetListEntityStockSchema,
  GetStockDetailsQueriesSchema,
  GetStocksQueriesSchema,
} from "./stock.schema.js"

export class StockController extends BaseController {
  constructor(
    private readonly module: StockModule,
    private readonly middleware: StockMiddleware
  ) {
    super("stocks")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest(
        "query",
        GetStocksQueriesSchema,
        this.middleware.prefillFilterByRole
      ),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/entities",
      this.validateRequest("query", GetEntityStocksQueriesSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.listByEntity(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/entities/sort",
      this.validateRequest("query", GetEntityStocksQueriesSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.listByEntitySort(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/details",
      this.validateRequest("query", GetStockDetailsQueriesSchema),
      async (c) => {
        const query = c.req.valid("query")
        const data = await this.module.details(c, query)
        return c.json({ data }, StatusCodes.OK)
      }
    )

    router.get(
      "/xls",
      this.validateRequest("query", GetStocksQueriesSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.export(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    // API TRIGGER NOTIF STOCK FOR TESTING ONLY
    // ================== START =================
    router.get(
      "/send-daily-stock-reminder",
      this.validateRequest("query", GetListEntityStockSchema),
      async (c) => {
        const query = c.req.valid("query")
        await this.module.triggerStockNotification(c, query)
        return c.json(
          {
            status: "daily stock notification process completed successfully",
          },
          StatusCodes.OK
        )
      }
    )

    router.get(
      "/send-daily-stock-expired-reminder",
      this.validateRequest("query", GetListEntityStockSchema),
      async (c) => {
        const query = c.req.valid("query")
        await this.module.triggerStockExpiredNotification(c, query)
        return c.json(
          {
            status:
              "daily stock expired notification process completed successfully",
          },
          StatusCodes.OK
        )
      }
    )

    router.get(
      "/send-daily-stock-reminder-non-hierarchy",
      this.validateRequest("query", GetListEntityStockSchema),
      async (c) => {
        const query = c.req.valid("query")
        await this.module.triggerStockNotification(c, query, false)
        return c.json(
          {
            status: "daily stock notification process completed successfully",
          },
          StatusCodes.OK
        )
      }
    )
    // ================== END =================

    return router
  }
}
