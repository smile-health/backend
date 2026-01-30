import { TRANSACTION_TYPE } from "@/common/constants/transaction.js"
import { datamart } from "@/common/infrastructure/database/datamart.js"
import { slave } from "@/common/infrastructure/database/slave.js"
import { env } from "@/config/env.js"
import { associate, group } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { sql } from "kysely"
import moment from "moment"
import { BaseRepository } from "../base.repository.js"
import {
  CreatePurchaseDTO,
  CreateTransactionOtherReasonsDTO,
  GetTransactionListConsumptionQueries,
  TransactionListDiscardRequestDTO,
  TransactionListPaginatedRequestDTO,
  TransactionReasonPaginatedRequestDTO,
  TransactionTypePaginatedRequestDTO,
  UpsertTransactionListDTO,
} from "./transaction.schema.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate"
import {
  CursorPaginatedResponse,
  CursorUtils,
  ICursorPaginationParams,
} from "@smile-health/lib/types/cursor-paginate"

export class TransactionRepository extends BaseRepository<"ws_transactions"> {
  constructor() {
    super("ws_transactions", false, true)
  }

  async createPurchase(c: Context, data: CreatePurchaseDTO): Promise<number> {
    const result = await c.var.trx
      .insertInto("ws_purchases")
      .values(data)
      .executeTakeFirst()

    return Number(result?.insertId)
  }

  async createTransactionOtherReason(
    c: Context,
    data: CreateTransactionOtherReasonsDTO
  ): Promise<number> {
    const result = await c.var.trx
      .insertInto("ws_other_reasons")
      .values(data)
      .executeTakeFirst()

    return Number(result?.insertId)
  }

  async updateOrCreateStockConsumption(
    c: Context,
    data: {
      vendor_stock_id: number
      batch_id?: number
      qty: number
      vendor_id: number
      customer_id: number
      material_id: number
      activity_id: number
    }
  ) {
    const vendorStock = await c.var.trx
      .selectFrom("ws_stocks")
      .select("activity_id")
      .where("id", "=", data.vendor_stock_id)
      .executeTakeFirstOrThrow()

    const insertData = {
      ...data,
      vendor_stock_activity_id: vendorStock.activity_id,
    }

    return await c.var.trx
      .insertInto("ws_stock_consumptions")
      .values(insertData)
      .onDuplicateKeyUpdate({
        qty: sql`qty + ${data.qty}`,
      })
      .executeTakeFirstOrThrow()
  }

  async findWsUserById(c: Context, id: number) {
    return c.var.trx
      .selectFrom("ws_users as wsu")
      .leftJoin("ws_entities as wse", "wse.id", "wsu.entity_id")
      .select([
        "wsu.id",
        "wsu.firstname",
        "wsu.lastname",
        "wsu.username",
        "wsu.role",
        "wsu.entity_id",
        "wse.type",
      ])
      .where("wsu.id", "=", id)
      .executeTakeFirst()
  }

  async findWsTransactionReasonByIds(
    c: Context,
    ids: number[],
    trxTypeId?: number
  ) {
    return c.var.trx
      .selectFrom("ws_transaction_reasons")
      .select(["id", "title", "title_en", "is_other", "is_purchase"])
      .where("id", "in", ids)
      .$if(!!trxTypeId, (q) => q.where("transaction_type_id", "=", trxTypeId!))
      .execute()
  }

  async findWsMaterialPermissonByIds(c: Context, ids: number[]) {
    const materialPermissons = await c.var.trx
      .selectFrom("ws_material_permissions")
      .select(["id", "material_id", "action", "key", "value"])
      .where("material_id", "in", ids)
      .where("action", "=", 7)
      .execute()
    return group(materialPermissons, "material_id")
  }

  async findWsEntityById(c: Context, id: number, programId: number) {
    return c.var.trx
      .selectFrom("ws_entities")
      .select(["id", "name", "is_open_vial"])
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .executeTakeFirst()
  }

  async findEntityActivityVendorCustomerEntityByIds(
    c: Context,
    programId: number,
    vendorId: number,
    customerId: number,
    entityActivityId: number,
    activityId: number
  ) {
    return c.var.trx
      .selectFrom("ws_entity_activities")
      .innerJoin(
        "ws_customer_vendors",
        "ws_customer_vendors.vendor_id",
        "ws_entity_activities.entity_id"
      )
      .select(["ws_entity_activities.id"])
      .where("ws_entity_activities.id", "=", entityActivityId)
      .where("ws_entity_activities.activity_id", "=", activityId)
      .where("ws_customer_vendors.customer_id", "=", customerId)
      .where("ws_customer_vendors.vendor_id", "=", vendorId)
      .where("program_id", "=", programId)
      .where("ws_customer_vendors.deleted_at", "is", null)
      .where("ws_entity_activities.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findWsMaterialByIds(c: Context, ids: number[], programId: number) {
    return c.var.trx
      .selectFrom("ws_materials as m")
      .select([
        "m.id as id",
        "m.parent_id as parent_material_id",
        "m.name as name",
        "m.is_temperature_sensitive as is_temperature_sensitive",
        "m.consumption_unit_per_distribution_unit as consumption_unit_per_distribution_unit",
        "m.is_managed_in_batch as is_managed_in_batch",
        "m.is_open_vial as is_open_vial",
      ])
      .where("m.id", "in", ids)
      .where("m.program_id", "=", programId)
      .execute()
  }

  async findWsManufactureByIds(c: Context, ids: number[], programId: number) {
    return c.var.trx
      .selectFrom("ws_manufactures")
      .select(["id", "name"])
      .where("id", "in", ids)
      .where("program_id", "=", programId)
      .execute()
  }

  async findWsStockByIds(
    c: Context,
    ids: number[],
    programId: number,
    isForUpdate: boolean = true // if false just for read (validation)
  ) {
    return c.var.trx
      .selectFrom("ws_stocks as s")
      .leftJoin("ws_activities as a", "s.activity_id", "a.id")
      .leftJoin("ws_budget_sources as bs", "s.budget_source_id", "bs.id")
      .select([
        "s.id",
        "s.material_id",
        "s.qty",
        "s.allocated_qty",
        "s.open_vial_qty",
        "s.batch_id",
        "bs.is_restricted as is_restricted",
      ])
      .where("s.id", "in", ids)
      .where("a.program_id", "=", programId)
      .$if(!!isForUpdate, (qb) => qb.forUpdate()) // lock row id until transaction ended
      .execute()
  }

  async findWsEntityActivityByEntityAndActivity(
    c: Context,
    entityId: number,
    activityId: number,
    programId: number
  ) {
    return c.var.trx
      .selectFrom("ws_entity_activities as wea")
      .leftJoin("ws_activities as a", "wea.activity_id", "a.id")
      .select([
        "wea.id",
        "wea.entity_id",
        "wea.activity_id",
        "wea.start_date",
        "wea.end_date",
      ])
      .where("wea.entity_id", "=", entityId)
      .where("wea.activity_id", "=", activityId)
      .where("a.program_id", "=", programId)
      .executeTakeFirst()
  }

  async findWsEntityActivityById(c: Context, id: number) {
    return c.var.trx
      .selectFrom("ws_entity_activities")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async findWsBudgetSourceIds(
    c: Context,
    budgetSourceId: number[],
    programId: number
  ) {
    return c.var.trx
      .selectFrom("ws_budget_sources")
      .select(["id", "program_id", "is_restricted"])
      .where("program_id", "=", programId)
      .where("id", "in", budgetSourceId)
      .execute()
  }

  async findWsTransactionTypeById(c: Context, id: number) {
    return c.var.trx
      .selectFrom("ws_transaction_types")
      .select(["id", "change_type"])
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async findWsTransactionByIds(
    c: Context,
    ids: number[],
    programId: number,
    transactionTypeId?: number,
    activityId?: number,
    isStatus?: boolean
  ) {
    return c.var.trx
      .selectFrom("ws_transactions as wt")
      .leftJoin("ws_activities as wa", "wa.id", "wt.activity_id")
      .selectAll("wt")
      .where("wt.id", "in", ids)
      .where("wt.deleted_at", "is", null)
      .where("wa.program_id", "=", programId)
      .$if(!!transactionTypeId, (qb) =>
        qb.where("wt.transaction_type_id", "=", transactionTypeId!)
      )
      .$if(!!activityId, (qb) => qb.where("wt.activity_id", "=", activityId!))
      .$if(!!isStatus, (qb) =>
        qb.where((eb) =>
          eb.or([eb("wt.status", "is", null), eb("wt.status", "=", 1)])
        )
      )
      .execute()
  }

  async getTransactionType(
    context: Context,
    params: TransactionTypePaginatedRequestDTO
  ) {
    let query = context.var.trx
      .selectFrom("ws_transaction_types")
      .where("ws_transaction_types.deleted_at", "is", null)
      .select(["id", "title", "sequence"])
      .orderBy("sequence", "asc")

    if (params.keyword) {
      query = query.where(
        `ws_transaction_types.title`,
        "like",
        `%${params.keyword}%`
      )
    }
    if (params.is_enable) {
      query = query.where(`ws_transaction_types.enable`, "=", params.is_enable)
    }

    const dataQuery = params.isPaginate
      ? query.limit(params.paginate).offset(params.offset).execute()
      : query.execute()

    const countQuery = query
      .clearSelect()
      .select((fn) => fn.fn.countAll().as("total"))
      .executeTakeFirst()

    const [data, count] = await Promise.all([dataQuery, countQuery])

    return {
      data,
      total: Number(count?.total ?? 0),
    }
  }

  async getTransactionReason(
    context: Context,
    params: TransactionReasonPaginatedRequestDTO
  ) {
    let query = context.var.trx
      .selectFrom("ws_transaction_reasons")
      .innerJoin(
        "ws_transaction_types",
        "ws_transaction_types.id",
        "ws_transaction_reasons.transaction_type_id"
      )
      .where("ws_transaction_reasons.deleted_at", "is", null)
      // .where("program_id", "=", Number(params.programId))
      .select([
        "ws_transaction_reasons.id",
        "ws_transaction_reasons.title",
        "ws_transaction_reasons.is_other",
        "ws_transaction_reasons.is_purchase",
        "ws_transaction_reasons.transaction_type_id",
        "ws_transaction_types.id as transaction_type_id",
        "ws_transaction_types.title as transaction_type_title",
      ])

    if (params.transaction_type_id) {
      query = query.where(
        "ws_transaction_reasons.transaction_type_id",
        "=",
        params.transaction_type_id
      )
    }
    if (params.keyword) {
      query = query.where(
        "ws_transaction_reasons.title",
        "like",
        `%${params.keyword}%`
      )
    }
    if ([0, 1].includes(Number(params.status))) {
      query = query.where("ws_transaction_reasons.status", "=", params.status!)
    }

    const dataQuery = params.isPaginate
      ? query.limit(params.paginate).offset(params.offset).execute()
      : query.execute()

    const countQuery = query
      .clearSelect()
      .select((fn) => fn.fn.countAll().as("total"))
      .executeTakeFirstOrThrow()

    const [data, count] = await Promise.all([dataQuery, countQuery])

    return {
      data,
      total: Number(count?.total ?? 0),
    }
  }

  async getTransactionList(
    context: Context,
    params: TransactionListPaginatedRequestDTO
  ) {
    // Existing offset-based implementation
    return this.getTransactionListOffset(context, params)
  }

  async getTransactionListOffset(
    context: Context,
    params: TransactionListPaginatedRequestDTO
  ) {
    if (params.entity_id) {
      return this.getEntityTransactions(context, params)
    }

    let query

    if (!env.LIST_USE_CLICKHOUSE) {
      // Use MySQL with getEntityTransactions pattern when LIST_USE_CLICKHOUSE is false
      query = context.var.trx
        .selectFrom("ws_transaction_lists")
        .selectAll()
        .select(sql<number>`COUNT(*) OVER ()`.as("total"))
        .where("program_id", "=", params.programId ?? 0)
        .where("deleted_at", "is", null) // always filter deleted_at
        .$if(!!params.start_date, (q) =>
          q.where("created_at", ">=", moment(params.start_date).toDate())
        )
        .$if(!!params.end_date, (q) =>
          q.where(
            "created_at",
            "<=",
            moment(params.end_date).add(1, "day").toDate()
          )
        )
        .$if(!!params.is_order, (q) => {
          if (params.is_order === "1") {
            return q.where("order_id", "is not", null)
          } else {
            return q.where("order_id", "is", null)
          }
        })
    } else {
      // Use ClickHouse when LIST_USE_CLICKHOUSE is enabled
      // Build PREWHERE conditions for ClickHouse optimization
      const prewhereConditions: string[] = []

      prewhereConditions.push(`program_id = ${params.programId ?? 0}`)

      if (params.start_date) {
        const startDate = moment(params.start_date).format(
          "YYYY-MM-DD 00:00:00"
        )
        prewhereConditions.push(`created_at >= '${startDate}'`)
      }

      if (params.end_date) {
        const endDate = moment(params.end_date).format("YYYY-MM-DD 23:59:59")
        prewhereConditions.push(`created_at <= '${endDate}'`)
      }

      if (params.is_order !== undefined) {
        if (params.is_order === "1") {
          prewhereConditions.push(`order_id IS NOT NULL`)
        } else {
          prewhereConditions.push(`order_id IS NULL`)
        }
      }

      const prewhereClause = prewhereConditions.join(" AND ")
      const datamartDB = context.var.datamart ?? datamart

      if (datamartDB) {
        query = datamartDB
          .selectFrom(
            sql`datamart_transaction_list_v5 FINAL PREWHERE ${sql.raw(prewhereClause)}`
          )
          .selectAll()
      } else {
        query = context.var.slave
          .selectFrom(
            sql`ws_transaction_lists FINAL PREWHERE ${sql.raw(prewhereClause)}`
          )
          .selectAll()
      }
    }

    const filters = [
      "activity_id",
      "material_type_id",
      "parent_material_id",
      "material_id",
      "transaction_type_id",
      "transaction_reason_id",
      "order_type",
      "entity_tag_id",
      "province_id",
      "regency_id",
      "entity_id",
    ]

    filters.forEach((filter) => {
      if (params[filter]) query = query.where(filter, "=", params[filter])
    })

    if (params.customer_tag_id) {
      query = query.where("customer_entity_tag_id", "=", params.customer_tag_id)
    }

    if (params.entity_for_consumption) {
      query = query.where(
        "companion_entity_id",
        "=",
        params.entity_for_consumption
      )
    }

    // Apply deleted_at filter only for ClickHouse databases
    if (env.LIST_USE_CLICKHOUSE && (context.var.datamart ?? datamart)) {
      query = query.where("deleted_at", "is", null)
    }

    query = query.orderBy("transaction_id desc")

    if (params?.isPaginate) {
      if (!env.LIST_USE_CLICKHOUSE) {
        // For MySQL, use the same pattern as getEntityTransactions
        const data = await query
          .limit(params.paginate)
          .offset(params.offset)
          .execute()

        return { data, total: Number(data[0]?.total ?? 0) }
      } else {
        // For ClickHouse, use the original pattern
        const [data, count] = await Promise.all([
          query.limit(params.paginate).offset(params.offset).execute(),
          query
            .clearSelect()
            .clearOrderBy()
            .select((fn) => fn.fn.countAll().as("total"))
            .executeTakeFirstOrThrow(),
        ])

        return { data, total: Number(count?.total ?? 0) }
      }
    }

    return query.stream()
  }

  async getTransactionListCursor(
    context: Context,
    params: ICursorPaginationParams & {
      programId?: number
      entity_id?: number
      activity_id?: number
      material_type_id?: number
      parent_material_id?: number
      material_id?: number
      transaction_type_id?: number
      transaction_reason_id?: number
      order_type?: string
      entity_tag_id?: number
      province_id?: number
      regency_id?: number
      customer_tag_id?: number
      entity_for_consumption?: number
      start_date?: string
      end_date?: string
      is_order?: string
      keyword?: string
    }
  ) {
    const { cursor, paginate, ...filters } = params

    let query = context.var.trx
      .selectFrom("ws_transaction_lists")
      .selectAll()
      .where("program_id", "=", filters.programId ?? 0)

    // Apply filters
    if (filters.entity_id) {
      query = query.where("entity_id", "=", filters.entity_id)
    }
    if (filters.activity_id) {
      query = query.where("activity_id", "=", filters.activity_id)
    }
    if (filters.material_type_id) {
      query = query.where("material_type_id", "=", filters.material_type_id)
    }
    if (filters.parent_material_id) {
      query = query.where("parent_material_id", "=", filters.parent_material_id)
    }
    if (filters.material_id) {
      query = query.where("material_id", "=", filters.material_id)
    }
    if (filters.transaction_type_id) {
      query = query.where(
        "transaction_type_id",
        "=",
        filters.transaction_type_id
      )
    }
    if (filters.transaction_reason_id) {
      query = query.where(
        "transaction_reason_id",
        "=",
        filters.transaction_reason_id
      )
    }
    if (filters.order_type) {
      query = query.where("order_type", "=", filters.order_type)
    }
    if (filters.entity_tag_id) {
      query = query.where("entity_tag_id", "=", filters.entity_tag_id)
    }
    if (filters.province_id) {
      query = query.where("province_id", "=", filters.province_id)
    }
    if (filters.regency_id) {
      query = query.where("regency_id", "=", filters.regency_id)
    }
    if (filters.customer_tag_id) {
      query = query.where(
        "customer_entity_tag_id",
        "=",
        filters.customer_tag_id
      )
    }
    if (filters.entity_for_consumption) {
      query = query.where(
        "companion_entity_id",
        "=",
        filters.entity_for_consumption
      )
    }
    if (filters.start_date) {
      query = query.where(
        "created_at",
        ">=",
        moment(filters.start_date).toDate()
      )
    }
    if (filters.end_date) {
      query = query.where(
        "created_at",
        "<=",
        moment(filters.end_date).add(1, "day").toDate()
      )
    }
    if (filters.is_order !== undefined) {
      if (filters.is_order === "1") {
        query = query.where("order_id", "is not", null)
      } else {
        query = query.where("order_id", "is", null)
      }
    }

    // Apply cursor-based pagination
    if (cursor) {
      try {
        const { id, created_at } = CursorUtils.parseTransactionCursor(cursor)
        query = query.where((eb) =>
          eb.or([
            eb("created_at", "<", created_at),
            eb.and([
              eb("created_at", "=", created_at),
              eb("transaction_id", "<", id),
            ]),
          ])
        )
      } catch (error) {
        throw new Error("Invalid cursor format")
      }
    }

    // Order by created_at DESC, transaction_id DESC for consistent pagination
    query = query
      .orderBy("created_at", "desc")
      .orderBy("transaction_id", "desc")

    // Fetch one extra record to determine if there's a next page
    const data = await query.limit(paginate + 1).execute()

    const hasNextPage = data.length > paginate
    const transactions = hasNextPage ? data.slice(0, paginate) : data

    let nextCursor: string | undefined
    let previousCursor: string | undefined

    if (hasNextPage && transactions.length > 0) {
      const lastTransaction = transactions[transactions.length - 1]
      nextCursor = CursorUtils.createTransactionCursor(
        lastTransaction.transaction_id,
        new Date(lastTransaction.created_at)
      )
    }

    if (cursor && transactions.length > 0) {
      const firstTransaction = transactions[0]
      previousCursor = CursorUtils.createTransactionCursor(
        firstTransaction.transaction_id,
        new Date(firstTransaction.created_at)
      )
    }

    return new CursorPaginatedResponse(
      { paginate, cursor },
      transactions,
      hasNextPage,
      !!cursor, // has previous page if cursor exists
      nextCursor,
      previousCursor
    )
  }

  // query to mysql instead of clickhouse if entity_id is already specified
  async getEntityTransactions(
    context: Context,
    params: TransactionListPaginatedRequestDTO
  ) {
    let query = context.var.trx
      .selectFrom("ws_transaction_lists")
      .selectAll()
      .select(sql<number>`COUNT(*) OVER ()`.as("total"))
      .where("entity_id", "=", params.entity_id!)
      .$if(!!params.start_date, (q) =>
        q.where("created_at", ">=", moment(params.start_date).toDate())
      )
      .$if(!!params.end_date, (q) =>
        q.where(
          "created_at",
          "<=",
          moment(params.end_date).add(1, "day").toDate()
        )
      )
      .$if(!!params.is_order, (q) => {
        if (params.is_order === "1") {
          return q.where("order_id", "is not", null)
        } else {
          return q.where("order_id", "is", null)
        }
      })

    const filters = [
      "activity_id",
      "material_type_id",
      "parent_material_id",
      "material_id",
      "transaction_type_id",
      "transaction_reason_id",
      "order_type",
      "entity_tag_id",
      "province_id",
      "regency_id",
      "entity_id",
    ]

    filters.forEach((filter) => {
      if (params[filter]) query = query.where(filter, "=", params[filter])
    })

    // Note: start_date, end_date, and is_order conditions are handled in PREWHERE for ClickHouse optimization

    if (params.customer_tag_id) {
      query = query.where("customer_entity_tag_id", "=", params.customer_tag_id)
    }

    if (params.entity_for_consumption) {
      query = query.where(
        "companion_entity_id",
        "=",
        params.entity_for_consumption
      )
    }

    // Apply deleted_at filter only for ClickHouse databases
    if (env.LIST_USE_CLICKHOUSE && (context.var.datamart ?? datamart)) {
      query = query.where("deleted_at", "is", null)
    }

    query = query.orderBy("transaction_id desc")

    if (params?.isPaginate) {
      const data = await query
        .limit(params.paginate)
        .offset(params.offset)
        .execute()

      return { data, total: Number(data[0]?.total ?? 0) }
    }

    return query.stream()
  }

  async findDetailById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_transaction_lists")
      .selectAll()
      .where("transaction_id", "=", id)
      .executeTakeFirst()
  }

  async getMapDetails(c: Context, ids: number[]) {
    const transactions = await c.var.trx
      .selectFrom("ws_transaction_lists")
      .selectAll()
      .where("transaction_id", "in", ids)
      .execute()

    return associate(transactions, "transaction_id")
  }

  async insertTransactionList(transaction: UpsertTransactionListDTO) {
    return await slave
      .insertInto("ws_transaction_lists")
      .values(transaction)
      .execute()
  }

  async getElasticTransactionList(
    c: Context,
    params: TransactionListPaginatedRequestDTO
  ) {
    let query = c.var.elastic.selectFrom("transactions")

    query = query
      .$if(!!params.entity_id, (q) =>
        q.where("entity_id", "=", Number(params.entity_id))
      )
      .$if(!!params.activity_id, (q) =>
        q.where("activity_id", "=", Number(params.activity_id))
      )
      .$if(!!params.start_date, (q) => {
        const startDate = moment
          .tz(params.start_date, String(params.timezone))
          .format("YYYY-MM-DDT00:00:00.000Z")

        return q.where("created_at", ">=", startDate)
      })
      .$if(!!params.end_date, (q) => {
        const endDate = moment
          .tz(params.end_date, String(params.timezone))
          .format("YYYY-MM-DDT23:59:59.999Z")

        return q.where("created_at", "<=", endDate)
      })

    query = query.orderBy("id", "asc")

    query = query.paginate(params.page, params.paginate)

    const lastHitSortValue = params.last_sort_value

    return await query.execute(lastHitSortValue)
  }

  async getTransactionListDiscard(
    context: Context,
    params: TransactionListDiscardRequestDTO,
    programId: number
  ) {
    let query = context.var.trx
      .selectFrom("ws_transactions as wt")
      .leftJoin("ws_activities as wa", "wa.id", "wt.activity_id")
      .leftJoin("ws_stocks as ws", "ws.id", "wt.stock_id")
      .leftJoin("ws_batches as wb", "wb.id", "ws.batch_id")
      .leftJoin("ws_materials as wm", "wm.id", "ws.material_id")
      .leftJoin(
        "ws_transaction_types as wtt",
        "wtt.id",
        "wt.transaction_type_id"
      )
      .leftJoin(
        "ws_transaction_reasons as wtr",
        "wtr.id",
        "wt.transaction_reason_id"
      )
      .leftJoin("ws_other_reasons as wor", (join) =>
        join
          .onRef("wor.source_id", "=", "wt.id")
          .on("wor.source_type", "=", "transaction")
      )
      .leftJoin("ws_users as wuc", "wuc.id", "wt.created_by")
      .leftJoin("ws_users as wuu", "wuu.id", "wt.updated_by")
      .where("wa.program_id", "=", programId ?? 0)
      .where("wt.transaction_type_id", "=", TRANSACTION_TYPE.DISCARDS)
      .where("wt.deleted_at", "is", null)
      // where status 1 or null
      .where((eb) =>
        eb.or([eb("wt.status", "is", null), eb("wt.status", "=", 1)])
      )

    if (params.activity_id) {
      query = query.where("wt.activity_id", "=", params.activity_id)
    }

    if (params.material_type_id) {
      query = query.where("wm.material_type_id", "=", params.material_type_id)
    }

    if (params.material_id) {
      query = query.where("ws.material_id", "=", params.material_id)
    }

    if (params.start_date) {
      const startDate = moment(params.start_date).format("YYYY-MM-DD 00:00:00")
      query = query.where("wt.created_at", ">=", sql<Date>`${startDate}`)
    }

    if (params.end_date) {
      const endDate = moment(params.end_date).format("YYYY-MM-DD 23:59:59")
      query = query.where("wt.created_at", "<=", sql<Date>`${endDate}`)
    }

    if (params.transaction_reason_id) {
      query = query.where(
        "wt.transaction_reason_id",
        "=",
        params.transaction_reason_id
      )
    }

    if (params.entity_id) {
      query = query.where("wt.entity_id", "=", params.entity_id)
    }

    const offset = (params.page - 1) * params.paginate
    const [data, count] = await Promise.all([
      query
        .select("wt.id as id")
        .select("wt.entity_id as entity_id")
        .select("ws.id as stock.id")
        .select("ws.qty as stock.qty")
        .select("wb.id as stock.batch.id")
        .select("wb.code as stock.batch.code")
        .select("wb.expired_date as stock.batch.expired_date")
        .select("wb.production_date as stock.batch.production_date")
        .select("wb.manufacture_id as stock.batch.manufacture_id")
        .select("ws.stock_quality_id as stock.stock_quality_id")
        .select("wm.id as material_id")
        .select("wm.id as material.id")
        .select("wm.name as material.name")
        .select("wm.description as material.description")
        .select("wm.is_open_vial as material.is_open_vial")
        .select("wm.material_type_id as material.material_type.id")
        .select("wm.material_type as material.material_type.name")
        .select("wa.id as activity_id")
        .select("wa.id as activity.id")
        .select("wa.name as activity.name")
        .select("wt.opening_qty as opening_qty")
        .select(sql`ABS(wt.change_qty)`.as("change_qty"))
        .select(sql`(wt.opening_qty + wt.change_qty)`.as("closing_qty"))
        .select("wt.opening_qty_open_vial")
        .select(sql`ABS(wt.change_qty_open_vial)`.as("change_qty_open_vial"))
        .select(
          sql`(wt.opening_qty_open_vial + wt.change_qty_open_vial)`.as(
            "closing_qty_open_vial"
          )
        )
        .select("wt.transaction_type_id as transaction_type_id")
        .select("wt.transaction_type_id as transaction_type.id")
        .select("wtt.title as transaction_type.title")
        .select("wtt.title_en as transaction_type.title_en")
        .select("wtt.change_type as transaction_type.change_type")
        .select("wt.transaction_reason_id as transaction_reason_id")
        .select("wt.transaction_reason_id as transaction_reason.id")
        .select("wtr.title as transaction_reason.title")
        .select("wtr.title_en as transaction_reason.title_en")
        .select("wtr.is_other as transaction_reason.is_other")
        .select("wtr.is_purchase as transaction_reason.is_purchase")
        .select("wor.content as other_reason")
        .select("wt.order_id as order_id")
        .select("wt.created_at as created_at")
        .select("wt.updated_at as updated_at")
        .select("wt.deleted_at as deleted_at")
        .select("wt.created_by as created_by")
        .select("wt.updated_by as updated_by")
        .select("wt.device_type as device_type")
        .select("wt.actual_transaction_date as actual_transaction_date")
        .select("wt.stock_id as stock_id")
        .select("wt.status as status")
        .select("wt.created_by as user_created_by.id")
        .select("wuc.username as user_created_by.username")
        .select("wuc.firstname as user_created_by.firstname")
        .select("wuc.lastname as user_created_by.lastname")
        .select("wt.updated_by as user_updated_by.id")
        .select("wuu.username as user_updated_by.username")
        .select("wuu.firstname as user_updated_by.firstname")
        .select("wuu.lastname as user_updated_by.lastname")
        .limit(params.paginate)
        .offset(offset)
        .execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data,
      total: Number(count.total),
    }
  }

  async getLastTransaction(c: Context, transactionId: number) {
    return c.var.trx
      .selectFrom("ws_transactions as wt")
      .select([
        "wt.id",
        sql`(wt.opening_qty_open_vial + wt.change_qty_open_vial)`.as(
          "closing_qty_open_vial"
        ),
      ])
      .where("wt.id", "=", transactionId)
      .where("wt.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getListStockConsumption(c: Context, ids: number[]) {
    return c.var.trx
      .selectFrom("ws_stock_consumptions")
      .where("vendor_stock_id", "in", ids)
      .where("deleted_at", "is", null)
      .select([
        "vendor_stock_id as stock_id",
        "qty",
        "batch_id",
        "vendor_id",
        "customer_id",
      ])
      .execute()
  }

  async getListConsumption(
    c: Context,
    params: GetTransactionListConsumptionQueries,
    programId: number,
    isReturn = false
  ) {
    const {
      page,
      paginate,
      entity_id,
      customer_id,
      activity_id,
      material_id,
      material_type_id,
      start_date,
      end_date,
    } = params
    const offset = (page - 1) * paginate

    const startDate = moment(start_date)
      .startOf("day")
      .format("YYYY-MM-DD HH:mm:ss")
    const endDate = moment(end_date).endOf("day").format("YYYY-MM-DD HH:mm:ss")

    const query = c.var.trx
      .selectFrom("ws_transactions as wst")
      .innerJoin("ws_stocks as wss", (join) =>
        join
          .onRef("wst.stock_id", "=", "wss.id")
          .on("wss.deleted_at", "is", null)
      )
      .innerJoin("ws_activities as wsat", (join) =>
        join
          .onRef("wst.activity_id", "=", "wsat.id")
          .on("wsat.program_id", "=", programId)
          .on("wsat.deleted_at", "is", null)
      )
      .innerJoin("ws_materials as wsmat", (join) =>
        join
          .onRef("wss.material_id", "=", "wsmat.id")
          .on("wsmat.program_id", "=", programId)
      )
      .leftJoin("ws_entities as wse", (join) =>
        join
          .onRef("wst.entity_id", "=", "wse.id")
          .on("wse.program_id", "=", programId)
      )
      .leftJoin("ws_activities as wsas", (join) =>
        join
          .onRef("wss.activity_id", "=", "wsas.id")
          .on("wsas.program_id", "=", programId)
          .on("wsas.deleted_at", "is", null)
      )
      .leftJoin("ws_batches as wsb", (join) =>
        join
          .onRef("wss.batch_id", "=", "wsb.id")
          .on("wsb.deleted_at", "is", null)
      )
      .leftJoin("ws_manufactures as wsmanu", (join) =>
        join
          .onRef("wsb.manufacture_id", "=", "wsmanu.id")
          .on("wsmanu.deleted_at", "is", null)
          .on("wsmanu.program_id", "=", programId)
      )
      .leftJoin("material_types as mt", (join) =>
        join
          .onRef("wsmat.material_type_id", "=", "mt.id")
          .on("mt.deleted_at", "is", null)
      )
      .leftJoin("ws_transaction_types as wstt", (join) =>
        join
          .onRef("wst.transaction_type_id", "=", "wstt.id")
          .on("wstt.deleted_at", "is", null)
      )
      .leftJoin("ws_transaction_reasons as wstr", (join) =>
        join
          .onRef("wst.transaction_reason_id", "=", "wstr.id")
          .on("wstr.deleted_at", "is", null)
      )
      .leftJoin("ws_other_reasons as wsor", (join) =>
        join
          .onRef("wst.id", "=", "wsor.source_id")
          .on("wsor.source_type", "=", "transaction")
          .on("wsor.deleted_at", "is", null)
      )
      .leftJoin("ws_users as wsuc", (join) =>
        join.onRef("wst.created_by", "=", "wsuc.id")
      )
      .leftJoin("ws_users as wsuu", (join) =>
        join.onRef("wst.updated_by", "=", "wsuu.id")
      )
      .where("wst.transaction_type_id", "=", !isReturn ? 10 : 5)
      .where("wst.returnable", "=", !isReturn ? 1 : 0)
      .where("wst.change_qty", "!=", 0)
      .$if(startDate !== undefined, (qb) =>
        qb.where("wst.created_at", ">=", sql<Date>`${startDate}`)
      )
      .$if(endDate !== undefined, (qb) =>
        qb.where("wst.created_at", "<=", sql<Date>`${endDate}`)
      )
      .$if(entity_id !== undefined, (qb) =>
        qb.where("wst.entity_id", "=", entity_id!)
      )
      .$if(customer_id !== undefined, (qb) =>
        qb.where("wst.companion_entity_id", "=", customer_id!)
      )
      .$if(activity_id !== undefined, (qb) =>
        qb.where("wst.activity_id", "=", activity_id!)
      )
      .$if(material_id !== undefined, (qb) =>
        qb.where("wsmat.id", "=", material_id!)
      )
      .$if(material_type_id !== undefined, (qb) =>
        qb.where("wsmat.material_type_id", "=", material_type_id!)
      )

    const [list, totalList] = await Promise.all([
      query
        .select([
          "wst.id as transaction_id",
          "wst.opening_qty",
          "wst.change_qty",
          "wst.order_id",
          "wst.created_at",
          "wst.updated_at",
          "wst.created_by",
          "wst.updated_by",
          "wst.device_type",
          "wst.actual_transaction_date",
          "wst.stock_id",
          "wst.status",
          "wst.returned_qty",
          "wst.qty_in_vial",
          "wse.id as entity_id",
          "wss.id as stock_id",
          "wss.qty as stock_qty",
          "wss.stock_quality_id",
          "wsb.id as batch_id",
          "wsb.code as batch_code",
          "wsb.expired_date as batch_expired_date",
          "wsb.production_date as batch_production_date",
          "wsmanu.id as manufacture_id",
          "wsmanu.name as manufacture_name",
          "wsmanu.description as manufacture_description",
          "wsmat.id as material_id",
          "wsmat.name as material_name",
          "wsmat.description as material_description",
          "wsmat.material_level_id",
          "wsmat.is_temperature_sensitive as material_is_temperature_sensitive",
          "wsmat.is_open_vial as material_is_open_vial",
          "wsmat.is_managed_in_batch as material_is_managed_in_batch",
          "wsmat.unit_of_consumption as material_unit_of_consumption",
          "wsmat.consumption_unit_per_distribution_unit",
          "mt.id as material_type_id",
          "mt.name as material_type_name",
          "wsas.id as activity_id_stock",
          "wsas.name as activity_name_stock",
          "wsat.id as activity_id_transaction",
          "wsat.name as activity_name_transaction",
          "wstt.id as transaction_type_id",
          "wstt.title as transaction_type_title",
          "wstt.title_en as transaction_type_title_en",
          "wstt.change_type as transaction_change_type",
          "wstr.id as transaction_reason_id",
          "wstr.title as transaction_reason_title",
          "wstr.title_en as transaction_reason_title_en",
          "wstr.is_other as transaction_reason_is_other",
          "wstr.is_purchase as transaction_reason_is_purchase",
          "wsor.content as other_reason",
          "wsuc.id as created_by_id",
          "wsuc.username as created_by_username",
          "wsuc.firstname as created_by_firstname",
          "wsuc.lastname as created_by_lastname",
          "wsuu.id as updated_by_id",
          "wsuu.username as updated_by_username",
          "wsuu.firstname as updated_by_firstname",
          "wsuu.lastname as updated_by_lastname",
        ])
        .limit(paginate)
        .offset(offset)
        .execute(),
      query.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return { list, total: Number(totalList?.total) || 0 }
  }

  async getListPatient(c: Context, listID: number[]) {
    const query = await c.var.trx
      .selectFrom("ws_consumptions as wsc")
      .innerJoin("ws_patients as wsp", (join) =>
        join
          .onRef("wsc.patient_id", "=", "wsp.id")
          .on("wsp.deleted_at", "is", null)
      )
      .leftJoin(
        "ws_patient_medical_histories as wpmh",
        "wpmh.patient_id",
        "wsp.id"
      )
      .leftJoin("protocols as wspc", "wspc.id", "wsc.protocol_id")
      .leftJoin(
        "ws_vaccine_sequences as wvs",
        "wvs.id",
        "wsc.vaccine_sequence_id"
      )
      .leftJoin("vaccine_methods as vm", "vm.id", "wvs.method_id")
      .leftJoin("vaccine_types as vt", "vt.id", "wvs.type_id")
      .where((eb) =>
        eb.or([
          eb("wsc.transaction_id", "in", listID),
          eb("wsc.return_transaction_id", "in", listID),
        ])
      )
      .select([
        "wsc.transaction_id",
        "wsc.return_transaction_id",
        "wsc.protocol_id",
        "wspc.name as protocol_name",
        "wspc.is_kipi",
        "wspc.is_medical_history",
        "wsp.identity_type",
        "wsp.nik as identity_number",
        "wsp.phone_number",
        "wsp.birth_date",
        "wsp.gender",
        "wpmh.is_diagnose_before",
        "wsc.vaccine_sequence_id",
        "wvs.title as vaccine_sequence_name",
        "wvs.method_id as vaccine_method_id",
        "vm.title as vaccine_method_name",
        "wvs.type_id as vaccine_type_id",
        "vt.title as vaccine_type_name",
      ])
      .execute()

    return query
  }

  async findTransactionList(c: Context, listID: number[]) {
    return c.var.trx
      .selectFrom("ws_transactions as wst")
      .leftJoin("ws_stocks as wss", (join) =>
        join
          .onRef("wst.stock_id", "=", "wss.id")
          .on("wss.deleted_at", "is", null)
      )
      .leftJoin("ws_materials as wsm", (join) =>
        join
          .onRef("wsm.id", "=", "wss.material_id")
          .on("wsm.deleted_at", "is", null)
      )
      .select([
        "wst.id",
        "wst.returned_qty",
        "wst.change_qty",
        "wst.qty_in_vial",
        "wsm.consumption_unit_per_distribution_unit",
      ])
      .where("wst.id", "in", listID)
      .execute()
  }

  async updateReturnedQtyTrx(
    c: Context,
    trxID: number,
    returnedQty: number,
    returnedQtyOpenVial: number,
    openVialQty: number,
    isReturnable: number
  ) {
    return c.var.trx
      .updateTable("ws_transactions")
      .set({
        returned_qty: sql`returned_qty + ${returnedQty}`,
        returned_qty_open_vial: sql`returned_qty_open_vial + ${returnedQtyOpenVial}`,
        qty_in_vial: sql`qty_in_vial + ${openVialQty}`,
        returnable: isReturnable,
        updated_at: new Date(),
      })
      .where("id", "=", trxID)
      .where("deleted_at", "is", null)
      .execute()
  }

  async createTrxReturnHistories(
    c: Context,
    trxIDConsumption: number,
    trxIDReturned: number,
    returnedQty: number,
    returnedQtyOpenVial: number,
    openVialQty: number
  ) {
    return c.var.trx
      .insertInto("ws_transactions_return_histories")
      .values({
        consumption_transaction_id: trxIDConsumption,
        return_transaction_id: trxIDReturned,
        return_qty: returnedQty,
        returned_qty_open_vial: returnedQtyOpenVial,
        qty_in_vial: openVialQty,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
  }

  async getListPatientConsumption(c: Context, listTrx: number[]) {
    return c.var.trx
      .selectFrom("ws_consumptions")
      .select(["patient_id", "transaction_id"])
      .where("patient_id", "is not", null)
      .where("deleted_at", "is", null)
      .where("transaction_id", "in", listTrx)
      .execute()
  }

  async getListTrxByPatientRabies(c: Context, listPatient: (number | null)[]) {
    return c.var.trx
      .selectFrom("ws_consumptions as wsc")
      .innerJoin("ws_consumption_rabies as wscr", (join) =>
        join
          .onRef("wscr.consumption_id", "=", "wsc.id")
          .on("wscr.deleted_at", "is", null)
      )
      .select(["wsc.patient_id", "wsc.transaction_id"])
      .where("wsc.deleted_at", "is", null)
      .where("wsc.patient_id", "is not", null)
      .where("wsc.patient_id", "in", listPatient)
      .orderBy("wsc.transaction_id", "desc")
      .execute()
  }

  async updatePatientRabies(c: Context, patientID: number, data) {
    return c.var.trx
      .updateTable("ws_patient_rabies")
      .set(data)
      .where("patient_id", "=", patientID)
      .execute()
  }

  async findTrxConsumptionRabies(c: Context, trxID: number) {
    return c.var.trx
      .selectFrom("ws_consumptions as wsc")
      .innerJoin("ws_consumption_rabies as wscr", (join) =>
        join
          .onRef("wscr.consumption_id", "=", "wsc.id")
          .on("wscr.deleted_at", "is", null)
      )
      .select([
        "wsc.patient_id",
        "wscr.vaccine_type",
        "wscr.vaccine_method",
        "wscr.vaccine_sequence",
        "wscr.created_at",
      ])
      .where("wsc.transaction_id", "=", trxID)
      .where("wsc.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async deletePatientRabies(c: Context, patientID: number) {
    await c.var.trx
      .deleteFrom("ws_patient_rabies")
      .where("patient_id", "=", patientID)
      .execute()
  }

  async updateTrxConsumption(c: Context, trxID: number, trxReturnID: number) {
    const consumption = await c.var.trx
      .selectFrom("ws_consumptions")
      .select(["id"])
      .where("transaction_id", "=", trxID)
      .execute()

    if (consumption && consumption.length)
      await Promise.all([
        c.var.trx
          .updateTable("ws_consumptions")
          .set({ deleted_at: new Date(), return_transaction_id: trxReturnID })
          .where("transaction_id", "=", trxID)
          .execute(),
        c.var.trx
          .updateTable("ws_consumptions")
          .set({ deleted_at: new Date() })
          .where(
            "reference_consumption_id",
            "in",
            consumption.map((con) => con.id)
          )
          .execute(),
      ])
  }

  async createDisposalStock(
    c: Context,
    data: {
      stock_id: number
      transaction_reason_id: number | undefined
      disposal_discard_qty: number
      disposal_received_qty: number
      disposal_qty: number
      disposal_shipped_qty: number
    }
  ) {
    const { userId } = c.var
    const result = await c.var.trx
      .insertInto("ws_disposal_stocks" as any)
      .values({
        stock_id: data.stock_id,
        transaction_reason_id: data.transaction_reason_id,
        disposal_discard_qty: data.disposal_discard_qty,
        disposal_received_qty: data.disposal_received_qty,
        disposal_qty: data.disposal_qty,
        disposal_shipped_qty: data.disposal_shipped_qty,
        created_by: userId!,
        updated_by: userId!,
        created_at: new Date(),
        updated_at: new Date(),
      } as any)
      .executeTakeFirst()

    return { insertId: result.insertId }
  }

  async createDisposalTransaction(
    c: Context,
    data: {
      disposal_transaction_type_id: number
      disposal_method_id: number
      entity_id: number
      activity_id: number
      material_id: number
      stock_disposal_id: number
      opening_qty: number
      change_qty: number
      open_vial: number
    }
  ) {
    const { userId: currentUserId } = c.var
    const disposalResult = await c.var.trx
      .insertInto("ws_disposal_transactions" as any)
      .values({
        disposal_transaction_type_id: data.disposal_transaction_type_id,
        disposal_method_id: data.disposal_method_id,
        entity_id: data.entity_id,
        activity_id: data.activity_id,
        material_id: data.material_id,
        stock_disposal_id: data.stock_disposal_id,
        opening_qty: data.opening_qty,
        change_qty: data.change_qty,
        open_vial: data.open_vial,
        created_by: currentUserId!,
        updated_by: currentUserId!,
        created_at: new Date(),
        updated_at: new Date(),
      } as any)
      .executeTakeFirst()

    return { insertId: disposalResult.insertId }
  }

  async getListStockBatch(c: Context, listStockID: number[]) {
    const list = await c.var.trx
      .selectFrom("ws_stocks as wss")
      .leftJoin("ws_batches as wsb", "wsb.id", "wss.batch_id")
      .select([
        "wss.id as stock_id",
        "wss.qty",
        "wss.open_vial_qty",
        "wsb.code as batch_code",
        "wss.material_id",
      ])
      .where("wss.id", "in", listStockID)
      .where("wsb.deleted_at", "is", null)
      .where("wss.deleted_at", "is", null)
      .execute()

    return list
  }

  async getDisposalStockByStockId(
    c: Context,
    stockId: number,
    reasonId?: number
  ) {
    return c.var.trx
      .selectFrom("ws_disposal_stocks")
      .selectAll()
      .where("stock_id", "=", stockId)
      .$if(!!reasonId, (eb) =>
        eb.where("transaction_reason_id", "=", reasonId!)
      )
      .executeTakeFirst()
  }

  async updateDisposalStock(
    c: Context,
    stockId: number,
    reasonId: number | undefined,
    data
  ) {
    return c.var.trx
      .updateTable("ws_disposal_stocks")
      .set(data)
      .where("stock_id", "=", stockId)
      .$if(!!reasonId, (eb) =>
        eb.where("transaction_reason_id", "=", reasonId!)
      )
      .execute()
  }

  async getMaterialNameBystockId(c: Context, stockId: number) {
    return c.var.trx
      .selectFrom("ws_stocks as wss")
      .leftJoin("ws_materials as wsm", "wsm.id", "wss.material_id")
      .select(["wsm.name as material_name"])
      .where("wss.id", "=", stockId)
      .where("wsm.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getEntityById(c: Context, entityId: number) {
    return c.var.trx
      .selectFrom("ws_entities")
      .selectAll()
      .where("id", "=", entityId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getMaterialByStockIds(c: Context, stockIds: number[]) {
    return c.var.trx
      .selectFrom("ws_stocks as wss")
      .leftJoin("ws_materials as wsm", "wsm.id", "wss.material_id")
      .select([
        "wsm.id as material_id",
        "wsm.name as material_name",
        "wsm.is_open_vial as is_open_vial",
      ])
      .where("wss.id", "in", stockIds)
      .where("wsm.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getConsumptionByTransactionId(c: Context, transactionId: number) {
    return c.var.trx
      .selectFrom("ws_consumptions")
      .selectAll()
      .where("transaction_id", "=", transactionId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getHigherSequenceConsumption(
    c: Context,
    consumptionId: number,
    protocolId: number,
    patientId: number
  ) {
    return c.var.trx
      .selectFrom("ws_consumptions")
      .selectAll()
      .where("protocol_id", "=", protocolId)
      .where("patient_id", "=", patientId)
      .where("id", ">", consumptionId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }
}
