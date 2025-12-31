import { Context } from "hono"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { TransactionListPaginatedRequestDTO } from "./transaction-list.schema.js"
import { TransactionListQuery } from "./transaction-list.query.js"

export class TransactionListRepository {
  constructor(private readonly transactionListQuery: TransactionListQuery) {}

  async getTransactionList(
    c: Context,
    params: TransactionListPaginatedRequestDTO
  ) {
    const dataQuery = this.transactionListQuery.generateTransactionListQuery(
      c,
      params
    )
    const countQuery = this.transactionListQuery.generateCountQuery(c, params)

    const queryParams: Record<string, any> = {
      programId: params.programId ?? 0,
    }

    // Add filter parameters
    const filterFields = [
      "activity_id",
      "material_type_id",
      "parent_material_id",
      "material_id",
      "transaction_type_id",
      "transaction_reason_id",
      "order_type",
      "entity_tag_id",
      "vendor_id",
      "province_id",
      "regency_id",
      "customer_entity_tag_id",
      "companion_entity_id",
      "entity_id",
    ]

    filterFields.forEach((field) => {
      if (params[field] !== undefined && params[field] !== null) {
        queryParams[field] = params[field]
      }
    })

    if (params.start_date) {
      queryParams.start_date = `${params.start_date} 00:00:00`
    }

    if (params.end_date) {
      queryParams.end_date = `${params.end_date} 23:59:59`
    }

    if (params.isPaginate) {
      queryParams.limit = params.paginate
      queryParams.offset = params.offset
    }

    const [data, countResult] = await Promise.all([
      execQuery<any[]>(dataQuery, queryParams),
      execQuery<{ total: number }[]>(countQuery, queryParams),
    ])

    const total = countResult[0]?.total ?? 0

    return { data, total }
  }
}
