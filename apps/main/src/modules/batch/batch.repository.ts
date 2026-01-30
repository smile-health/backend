import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { associate } from "@smile-health/lib/utils.js"
import { Context as CtxHono } from "hono"
import { sql } from "kysely"
import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { BaseRepository } from "../base.repository.js"
import { CreateBatchyDTO, GetListBatchQueries } from "./batch.schema.js"

export class BatchRepository extends BaseRepository<"ws_batches"> {
  constructor() {
    super("ws_batches", false, false, true, false)
  }

  async createBatch(c: Context<DB>, data: CreateBatchyDTO): Promise<number> {
    const result = await c.var.trx
      .insertInto("ws_batches")
      .values(data)
      .executeTakeFirst()

    return Number(result?.insertId)
  }

  async findListBatch(
    c: Context<DB>,
    params: GetListBatchQueries,
    programId: number
  ) {
    const { page, paginate, keyword, material_ids, material_level_id } = params
    const offset = (page - 1) * paginate

    let baseQuery = c.var.trx
      .selectFrom("ws_batches as b")
      .leftJoin("ws_manufactures as mn", "mn.id", "b.manufacture_id")
      .where("mn.program_id", "=", programId)
      .where("b.deleted_at", "is", null)

    if (material_ids && material_ids.length > 0) {
      baseQuery = baseQuery.where((eb) =>
        eb.exists(
          eb
            .selectFrom("ws_stocks as s")
            .select("s.id")
            .whereRef("s.batch_id", "=", "b.id")
            .$if(material_level_id === KFA_LEVEL_ID.TEMPLATE, (qb) =>
              qb.where("s.parent_material_id", "in", material_ids)
            )
            .$if(material_level_id !== KFA_LEVEL_ID.TEMPLATE, (qb) =>
              qb.where("s.material_id", "in", material_ids)
            )
        )
      )
    }

    if (keyword) {
      baseQuery = baseQuery.where("b.code", "like", `%${keyword}%`)
    }

    const [list, count] = await Promise.all([
      baseQuery
        .limit(paginate)
        .offset(offset)
        .select(["b.id", sql`COALESCE(b.code, '')`.as("code")])
        .orderBy("b.code")
        .execute(),
      baseQuery
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      list: list.map((item) => ({ ...item, code: (item.code as string).trim() })),
      total: Number(count.total),
    }
  }

  async findWsBatchById(c: Context<DB>, id: number) {
    return c.var.trx
      .selectFrom("ws_batches")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
  }

  // used by app mobile data module
  async getBatchAssociate(c: CtxHono, ids: number[]) {
    if (ids.length == 0) return []

    const data = await c.var.trx
      .selectFrom("ws_batches as wb")
      .leftJoin("ws_manufactures as wm", "wb.manufacture_id", "wm.id")
      .where("wb.id", "in", ids)
      .select([
        "wb.id",
        "wb.manufacture_id",
        "wb.code",
        "wb.expired_date",
        "wb.production_date",
        sql`
          COALESCE(
            JSON_OBJECT(
              'id', wm.id,
              'name', wm.name,
              'address', wm.address,
              'description', wm.description
            ), JSON_OBJECT()
          )
        `.as("manufacture"),
      ])
      .execute()

    return associate(data, "id")
  }
}
