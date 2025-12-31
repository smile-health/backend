import { BaseModule } from '@/modules/base.module.js'
import { LoggerRepository } from './logger.repository.js'
import type {
  Logger,
  AddLoggerDTO,
  EditLoggerDTO,
  UpdateLoggerStatusDTO,
  LoggerQuery,
} from './logger.schema.js'
import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

export class LoggerModule extends BaseModule {
  private loggerRepository: LoggerRepository

  constructor(loggerRepository: LoggerRepository) {
    super()
    this.loggerRepository = loggerRepository
  }

  async list(query: LoggerQuery, page: number = 1, limit: number = 10) {
    try {
      const result = await this.loggerRepository.list(query, page, limit)
      
      return this.formatListResponse(
        result.data,
        result.pagination.total,
        result.pagination.totalPages,
        result.pagination.limit
      )
    } catch (error) {
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : 'Failed to fetch loggers',
      })
    }
  }

  async detail(id: number) {
    try {
      const logger = await this.loggerRepository.getById(id)
      
      if (!logger) {
        throw new HTTPException(404, {
          message: 'Logger not found',
        })
      }

      return this.formatDetailResponse(logger)
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : 'Failed to fetch logger',
      })
    }
  }

  async create(data: AddLoggerDTO) {
    try {
      const logger = await this.loggerRepository.create(data)
      return this.formatDetailResponse(logger)
    } catch (error) {
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : 'Failed to create logger',
      })
    }
  }

  async update(id: number, data: EditLoggerDTO) {
    try {
      // Check if logger exists
      const existingLogger = await this.loggerRepository.getById(id)
      if (!existingLogger) {
        throw new HTTPException(404, {
          message: 'Logger not found',
        })
      }

      const updatedLogger = await this.loggerRepository.update(id, data)
      return this.formatDetailResponse(updatedLogger)
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : 'Failed to update logger',
      })
    }
  }

  async updateStatus(id: number, data: UpdateLoggerStatusDTO) {
    try {
      // Check if logger exists
      const existingLogger = await this.loggerRepository.getById(id)
      if (!existingLogger) {
        throw new HTTPException(404, {
          message: 'Logger not found',
        })
      }

      const updatedLogger = await this.loggerRepository.updateStatus(id, data.status)
      return this.formatDetailResponse(updatedLogger)
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : 'Failed to update logger status',
      })
    }
  }

  async delete(id: number) {
    try {
      // Check if logger exists
      const existingLogger = await this.loggerRepository.getById(id)
      if (!existingLogger) {
        throw new HTTPException(404, {
          message: 'Logger not found',
        })
      }

      await this.loggerRepository.delete(id)
      return {
        message: 'Logger deleted successfully',
      }
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : 'Failed to delete logger',
      })
    }
  }

  private formatListResponse(data: Logger[], total: number, totalPages: number, perPage: number) {
    return {
      data,
      meta: {
        total,
        totalPages,
        perPage,
      },
    }
  }

  private formatDetailResponse(data: Logger) {
    return {
      data,
    }
  }
}