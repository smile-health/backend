import { BaseController } from '@/modules/base.controller.js'
import { LoggerModule } from './logger.module.js'
import {
  AddLoggerDTOSchema,
  EditLoggerDTOSchema,
  UpdateLoggerStatusDTOSchema,
  LoggerQuerySchema,
} from './logger.schema.js'
import { Context, Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { StatusCodes } from 'http-status-codes'

export class LoggerController extends BaseController {
  private loggerModule: LoggerModule

  constructor(loggerModule: LoggerModule) {
    super()
    this.loggerModule = loggerModule
  }

  getRoutes(): Hono {
    const router = new Hono()

    // GET /loggers - List all loggers
    router.get(
      "/",
      this.validateRequest("query", LoggerQuerySchema),
      async (c) => {
        return this.list(c)
      }
    )

    // GET /loggers/:id - Get logger detail
    router.get(
      "/:id",
      async (c) => {
        return this.detail(c)
      }
    )

    // POST /loggers - Create new logger
    router.post(
      "/",
      this.validateRequest("json", AddLoggerDTOSchema),
      async (c) => {
        return this.create(c)
      }
    )

    // PUT /loggers/:id - Update logger
    router.put(
      "/:id",
      this.validateRequest("json", EditLoggerDTOSchema),
      async (c) => {
        return this.update(c)
      }
    )

    // PATCH /loggers/:id/status - Update logger status
    router.patch(
      "/:id/status",
      this.validateRequest("json", UpdateLoggerStatusDTOSchema),
      async (c) => {
        return this.updateStatus(c)
      }
    )

    // DELETE /loggers/:id - Delete logger
    router.delete(
      "/:id",
      async (c) => {
        return this.delete(c)
      }
    )

    return router
  }

  async list(c: Context) {
    try {
      const query = LoggerQuerySchema.parse(c.req.query())
      const page = parseInt(query.page || '1')
      const limit = parseInt(query.paginate || '10')

      const result = await this.loggerModule.list(query, page, limit)
      return c.json(result)
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : 'Failed to fetch loggers',
      })
    }
  }

  async detail(c: Context) {
    try {
      const id = parseInt(c.req.param('id'))
      if (isNaN(id)) {
        throw new HTTPException(400, {
          message: 'Invalid logger ID',
        })
      }

      const result = await this.loggerModule.detail(id)
      return c.json(result)
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : 'Failed to fetch logger',
      })
    }
  }

  async create(c: Context) {
    try {
      const body = await c.req.json()
      const data = AddLoggerDTOSchema.parse(body)

      const result = await this.loggerModule.create(data)
      return c.json(result, 201)
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : 'Failed to create logger',
      })
    }
  }

  async update(c: Context) {
    try {
      const id = parseInt(c.req.param('id'))
      if (isNaN(id)) {
        throw new HTTPException(400, {
          message: 'Invalid logger ID',
        })
      }

      const body = await c.req.json()
      const data = EditLoggerDTOSchema.parse(body)

      const result = await this.loggerModule.update(id, data)
      return c.json(result)
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : 'Failed to update logger',
      })
    }
  }

  async updateStatus(c: Context) {
    try {
      const id = parseInt(c.req.param('id'))
      if (isNaN(id)) {
        throw new HTTPException(400, {
          message: 'Invalid logger ID',
        })
      }

      const body = await c.req.json()
      const data = UpdateLoggerStatusDTOSchema.parse(body)

      const result = await this.loggerModule.updateStatus(id, data)
      return c.json(result)
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : 'Failed to update logger status',
      })
    }
  }

  async delete(c: Context) {
    try {
      const id = parseInt(c.req.param('id'))
      if (isNaN(id)) {
        throw new HTTPException(400, {
          message: 'Invalid logger ID',
        })
      }

      const result = await this.loggerModule.delete(id)
      return c.json(result)
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : 'Failed to delete logger',
      })
    }
  }
}