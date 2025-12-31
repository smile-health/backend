import { BaseController } from '@/modules/base.controller.js'
import { LoggerHistoryRepository } from './logger-history.repository.js'
import { AssetInventoryRepository } from '../asset-inventory/asset-inventory.repository.js'
import {
  PushLoggerHistoryDTOSchema,
  PushSingleLoggerHistoryDTOSchema,
} from './logger-history.schema.js'
import { Context, Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { StatusCodes } from 'http-status-codes'

export class LoggerHistoryController extends BaseController {
  private loggerHistoryRepo: LoggerHistoryRepository
  private assetInventoryRepo: AssetInventoryRepository

  constructor(
    loggerHistoryRepo: LoggerHistoryRepository,
    assetInventoryRepo: AssetInventoryRepository
  ) {
    super()
    this.loggerHistoryRepo = loggerHistoryRepo
    this.assetInventoryRepo = assetInventoryRepo
  }

  getRoutes(): Hono {
    const router = new Hono()

    // POST /logger-histories/push - Push history data (v2 pattern - array)
    router.post(
      "/push",
      this.validateRequest("json", PushLoggerHistoryDTOSchema),
      async (c) => {
        return this.pushHistoryData(c)
      }
    )

    // POST /logger-histories/push-single - Push single history (v1 pattern)
    router.post(
      "/push-single",
      this.validateRequest("json", PushSingleLoggerHistoryDTOSchema),
      async (c) => {
        return this.pushSingleHistory(c)
      }
    )

    return router
  }

  async pushHistoryData(c: Context) {
    try {
      const newData = await c.req.json()

      if (!Array.isArray(newData)) {
        throw new HTTPException(StatusCodes.BAD_REQUEST, {
          message: 'Data is not array'
        })
      }

      // Import the module here to avoid circular dependency
      const { LoggerHistoryModule } = await import('./logger-history.module.js')
      const loggerHistoryModule = new LoggerHistoryModule(this.loggerHistoryRepo)

      const result = await loggerHistoryModule.pushHistoryData(c, newData)

      return c.json(result)
    } catch (err: any) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: err.message || 'No data'
      })
    }
  }

  async pushSingleHistory(c: Context) {
    try {
      const body = await c.req.json()

      // Import the module here to avoid circular dependency
      const { LoggerHistoryModule } = await import('./logger-history.module.js')
      const loggerHistoryModule = new LoggerHistoryModule(this.loggerHistoryRepo)

      const result = await loggerHistoryModule.pushSingleHistory(c, body)

      return c.json(result)
    } catch (err: any) {
      throw new HTTPException(StatusCodes.BAD_REQUEST, {
        message: err.message || 'No data'
      })
    }
  }
}