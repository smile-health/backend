import { db } from "@/common/infrastructure/database/index.js"
import { Context } from "hono"
import { sql } from "kysely"
import moment from "moment"
import { z } from "zod"
import { BaseRepository } from "../base.repository.js"
import { GetExportHistoriesQueries } from "./export-history.schema.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile-health/lib/types/context.js"

export class ExportHistoryRepository extends BaseRepository<"export_histories"> {
  constructor() {
    super("export_histories", true)
  }

  async findAll(c: Context, params: z.infer<typeof GetExportHistoriesQueries>) {
    let query = c.var.trx.selectFrom(this.tableName).selectAll(this.tableName)

    query = query
      .where("created_by", "=", c.var.accountID)
      .where((eb) =>
        eb("expires_at", ">", new Date()).or("expires_at", "is", null)
      )

    if (params.keyword) {
      query = query.where("filename", "like", `%${params.keyword}%`)
    }

    if (params.start_date) {
      query = query.where((eb) =>
        eb(
          "created_at",
          ">=",
          sql<Date>`${moment(params.start_date).format("YYYY-MM-DD 00:00:00")}`
        )
      )
    }

    if (params.end_date) {
      query = query.where((eb) =>
        eb(
          "created_at",
          "<=",
          sql<Date>`${moment(params.end_date).format("YYYY-MM-DD 23:59:59")}`
        )
      )
    }

    if (params.program_id !== undefined) {
      query = query.where((eb) =>
        params.program_id === 0
          ? eb("program_id", "is", null)
          : eb("program_id", "=", params.program_id as number)
      )
    }

    const countQuery = query.select((eb) => eb.fn.countAll().as("total"))
    const offset = (params.page - 1) * (params.paginate ?? 10)
    const dataQuery = query
      .$if(!!params.paginate, (qb) =>
        qb.limit(params.paginate ?? 10).offset(offset)
      )
      .orderBy("created_at", "desc")

    const [countResult, data] = await Promise.all([
      countQuery.executeTakeFirst(),
      dataQuery.execute(),
    ])

    return {
      data,
      total: Number(countResult?.total ?? 0),
    }
  }

  async findByFilename(c: Context, file: string) {
    const result = await c.var.trx
      .selectFrom(this.tableName)
      .selectAll(this.tableName)
      .where("original_filename", "=", file)
      .where("created_by", "=", c.var.accountID)
      .where((eb) =>
        eb("expires_at", ">", new Date()).or("expires_at", "is", null)
      )
      .executeTakeFirst()

    return result
  }

  async upsert(c: CustomContext<DB>, data, id?: number) {
    if (id) {
      await db
        .updateTable("export_histories")
        .set(data)
        .where("id", "=", id)
        .executeTakeFirst()
      return { id }
    }

    if (!data.original_filename || !data.filename || !data.created_by) {
      throw new Error("Missing required fields for creating export history")
    }

    return await c.var.trx
      .insertInto("export_histories")
      .values(data)
      .executeTakeFirst()
  }
}
