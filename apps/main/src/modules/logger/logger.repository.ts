import { BaseRepository } from '@/modules/base.repository.js'
import { db } from '@/common/infrastructure/database/index.js'
import type { Logger, LoggerQuery } from './logger.schema.js'
import { sql } from 'kysely'

export class LoggerRepository extends BaseRepository {
  constructor() {
    super()
  }

  async getById(id: number): Promise<Logger | undefined> {
    return await db
      .selectFrom('logger')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst() as Logger | undefined
  }

  async list(query: LoggerQuery, page: number = 1, limit: number = 10) {
    let baseQuery = db
      .selectFrom('logger')
      .selectAll()
      .orderBy('created_at', 'desc')

    // Apply filters
    if (query.asset_id) {
      baseQuery = baseQuery.where('asset_id', '=', parseInt(query.asset_id))
    }

    if (query.serial_number) {
      baseQuery = baseQuery.where('serial_number', 'like', `%${query.serial_number}%`)
    }

    // Get total count
    const totalQuery = baseQuery
      .select(sql`COUNT(*)`.as('total'))
      .clearSelect()
      .clearOrderBy()

    const totalResult = await totalQuery.executeTakeFirst() as { total: number }
    const total = totalResult?.total || 0

    // Get paginated results
    const offset = (page - 1) * limit
    const results = await baseQuery
      .limit(limit)
      .offset(offset)
      .execute() as Logger[]

    const totalPages = Math.ceil(total / limit)

    return {
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }
  }

  async create(data: Omit<Logger, 'id' | 'created_at' | 'updated_at'>): Promise<Logger> {
    const result = await db
      .insertInto('logger')
      .values({
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow() as Logger

    return result
  }

  async update(id: number, data: Partial<Omit<Logger, 'id' | 'created_at' | 'updated_at'>>): Promise<Logger> {
    const result = await db
      .updateTable('logger')
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow() as Logger

    return result
  }

  async updateStatus(id: number, status: number): Promise<Logger> {
    const result = await db
      .updateTable('logger')
      .set({
        status,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow() as Logger

    return result
  }

  async delete(id: number): Promise<void> {
    await db
      .deleteFrom('logger')
      .where('id', '=', id)
      .execute()
  }
}