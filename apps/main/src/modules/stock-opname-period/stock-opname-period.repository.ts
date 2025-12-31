import {
  DB,
  WsStockOpnamePeriods,
} from "@/common/infrastructure/database/types/db.js"
import { type Context } from "hono"
import { SelectQueryBuilder, sql } from "kysely"
import { type z } from "zod"
import { BaseRepository } from "../base.repository.js"
import { GetStockOpnamePeriodsQueries } from "./stock-opname-period.schema.js"

type StockOpnamePeriodsQueries = z.infer<typeof GetStockOpnamePeriodsQueries>

export default class StockOpnamePeriodRepository extends BaseRepository<"ws_stock_opname_periods"> {
  constructor() {
    super("ws_stock_opname_periods", true)
  }

  #conditionStockOpnamePeriodWhereClause(
    query: SelectQueryBuilder<
      DB & { wssop: WsStockOpnamePeriods },
      "wssop",
      object
    >,
    params: StockOpnamePeriodsQueries,
    c: Context
  ) {
    let filteredQuery = query
      .where("program_id", "=", c.var.programId)
      .where("deleted_at", "is", null)

    if (params.status !== undefined) {
      filteredQuery = filteredQuery.where("status", "=", params.status)
    }

    if (params.year_period) {
      filteredQuery = filteredQuery.where(
        "year_period",
        "=",
        params.year_period
      )
    }
    if (params.month_period) {
      filteredQuery = filteredQuery.where(
        "month_period",
        "=",
        params.month_period
      )
    }

    if (params.start_date) {
      filteredQuery = filteredQuery.where((eb) =>
        eb("start_date", ">=", params.start_date!)
      )
    }

    if (params.end_date) {
      filteredQuery = filteredQuery.where((eb) =>
        eb("end_date", "<=", params.end_date!)
      )
    }

    return filteredQuery
  }

  async findAll(c: Context, params: StockOpnamePeriodsQueries) {
    const query = c.var.trx
      .selectFrom(`${this.tableName} as wssop`)
      .selectAll("wssop")

    const filteredQuery = this.#conditionStockOpnamePeriodWhereClause(
      query,
      params,
      c
    )

    const countQuery = filteredQuery.select((eb) =>
      eb.fn.countAll().as("total")
    )
    const dataQuery = filteredQuery
      .$if(!!params.paginate, (qb) =>
        qb
          .limit(params.paginate ?? 10)
          .offset((params.page - 1) * (params.paginate ?? 10))
      )
      .orderBy("status", "desc")
      .orderBy("year_period", "desc")
      .orderBy("month_period", "desc")

    const [count, data] = await Promise.all([
      countQuery.executeTakeFirst(),
      dataQuery.execute(),
    ])

    return {
      data,
      total: Number(count?.total ?? 0),
    }
  }

  async findById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom(this.tableName)
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", c.var.programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getListOpnamePeriodStream(
    c: Context,
    params: StockOpnamePeriodsQueries
  ) {
    const query = c.var.trx.selectFrom(`${this.tableName} as wssop`)

    const filteredQuery = this.#conditionStockOpnamePeriodWhereClause(
      query,
      params,
      c
    )

    const dataQuery = filteredQuery
      .leftJoin(
        (eb) =>
          eb
            .selectFrom("ws_users")
            .select(["id", "firstname", "lastname"])
            .as("wsuc"),
        (join) => join.onRef("wsuc.id", "=", "wssop.created_by")
      )
      .leftJoin(
        (eb) =>
          eb
            .selectFrom("ws_users")
            .select(["id", "firstname", "lastname"])
            .as("wsuu"),
        (join) => join.onRef("wsuu.id", "=", "wssop.updated_by")
      )
      .select([
        "wssop.id",
        "wssop.start_date",
        "wssop.end_date",
        "wssop.month_period",
        "wssop.year_period",
        "wssop.status",
        "wssop.created_at",
        "wssop.updated_at",
        sql<string>`COALESCE(CONCAT_WS('', wsuc.firstname, wsuc.lastname), '')`.as(
          "full_name_created"
        ),
        sql<string>`COALESCE(CONCAT_WS('', wsuu.firstname, wsuu.lastname), '')`.as(
          "full_name_updated"
        ),
      ])
      .orderBy("status", "desc")
      .orderBy("year_period", "desc")
      .orderBy("month_period", "desc")
      .stream()

    return dataQuery
  }
}
