/* eslint-disable @typescript-eslint/no-explicit-any */
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "hono"
import { ReferenceExpression } from "kysely"

export abstract class BaseRepository<TableName extends keyof DB & string> {
  constructor(
    protected tableName: TableName,
    protected filterProgram = true,
    protected filterActivity = false,
    protected useSoftDelete = true,
    protected useAudit = true
  ) {}

  async find(c: Context, where: Partial<Record<keyof DB[TableName], any>>) {
    let query = c.var.trx
      .selectFrom(this.tableName as keyof DB)
      .selectAll(this.tableName)

    for (const [key, value] of Object.entries(where)) {
      const operator = value instanceof Array ? "in" : "="
      query = query.where(
        key as ReferenceExpression<DB, keyof DB>,
        operator,
        value
      )
    }

    if (this.useSoftDelete) {
      query = query.where("deleted_at", "is", null)
    }

    if (this.filterActivity) {
      query = query.where("activity_id", "in", c.var.activityIds)
    } else if (this.filterProgram) {
      query = query.where("program_id", "=", c.var.programId)
    }

    return await query.execute()
  }

  async findOne(c: Context, where: Partial<Record<keyof DB[TableName], any>>) {
    return (await this.find(c, where))[0]
  }

  async create(c: Context, data: Partial<Record<keyof DB[TableName], any>>) {
    if (this.useAudit) {
      data = { created_by: c.var.userId, updated_by: c.var.userId, ...data }
    }

    if (this.filterProgram) {
      data = { program_id: c.var.programId, ...data }
    }

    return await c.var.trx
      .insertInto(this.tableName as keyof DB)
      .values(data)
      .executeTakeFirstOrThrow()
  }

  async createMany(
    c: Context,
    data: Array<Partial<Record<keyof DB[TableName], any>>>
  ) {
    if (this.useAudit) {
      data = data.map((item) => ({ created_by: c.var.userId, ...item }))
    }

    return await c.var.trx
      .insertInto(this.tableName as keyof DB)
      .values(data)
      .execute()
  }

  async update(
    c: Context,
    data: Partial<Record<keyof DB[TableName], any>>,
    where: Partial<Record<keyof DB[TableName], any>>
  ) {
    if (this.useAudit) {
      data = { updated_by: c.var.userId, updated_at: new Date(), ...data }
    }

    if (this.filterProgram) {
      where = { program_id: c.var.programId, ...where }
    }

    let query = c.var.trx.updateTable(this.tableName as keyof DB).set(data)

    for (const [key, value] of Object.entries(where)) {
      const operator = value instanceof Array ? "in" : "="
      query = query.where(
        key as ReferenceExpression<DB, keyof DB>,
        operator,
        value
      )
    }

    return await query.execute()
  }

  async delete(c: Context, where: Partial<Record<keyof DB[TableName], any>>) {
    if (this.useSoftDelete) {
      let data: object = { deleted_at: new Date() }
      if (this.useAudit) {
        data = { deleted_by: c.var.userId, ...data }
      }

      return await this.update(c, data, where)
    }

    let query = c.var.trx.deleteFrom(this.tableName as keyof DB)
    for (const [key, value] of Object.entries(where)) {
      const operator = value instanceof Array ? "in" : "="
      query = query.where(
        key as ReferenceExpression<DB, keyof DB>,
        operator,
        value
      )
    }

    return await query.execute()
  }
}
