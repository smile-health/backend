import { Context } from "hono"
import { TransactionListPaginatedRequestDTO } from "./transaction-list.schema.js"

export class TransactionListQuery {
  generateTransactionListQuery(
    c: Context,
    params: TransactionListPaginatedRequestDTO
  ): string {
    const filters: string[] = []
    const queryParams: Record<string, any> = {}

    // Base query with the new table name
    let sql = `SELECT * FROM datamart_transaction_list_v5 WHERE program_id = {programId:UInt32}`
    queryParams.programId = params.programId ?? 0

    // Add filters
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
        filters.push(`${field} = {${field}:UInt32}`)
        queryParams[field] = params[field]
      }
    })

    if (params.start_date) {
      filters.push(`created_at >= {start_date:DateTime}`)
      queryParams.start_date = `${params.start_date} 00:00:00`
    }

    if (params.end_date) {
      filters.push(`created_at <= {end_date:DateTime}`)
      queryParams.end_date = `${params.end_date} 23:59:59`
    }

    if (params.has_order !== undefined) {
      if (params.has_order === "1") {
        filters.push(`order_id IS NOT NULL`)
      } else {
        filters.push(`order_id IS NULL`)
      }
    }

    if (filters.length > 0) {
      sql += ` AND ${filters.join(" AND ")}`
    }

    sql += ` ORDER BY transaction_id DESC`

    if (params.isPaginate) {
      sql += ` LIMIT {limit:UInt32} OFFSET {offset:UInt32}`
      queryParams.limit = params.paginate
      queryParams.offset = params.offset
    }

    return sql
  }

  generateCountQuery(
    c: Context,
    params: TransactionListPaginatedRequestDTO
  ): string {
    const filters: string[] = []

    let sql = `SELECT COUNT(*) as total FROM datamart_transaction_list_v5 WHERE program_id = {programId:UInt32}`

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
        filters.push(`${field} = {${field}:UInt32}`)
      }
    })

    if (params.start_date) {
      filters.push(`created_at >= {start_date:DateTime}`)
    }

    if (params.end_date) {
      filters.push(`created_at <= {end_date:DateTime}`)
    }

    if (params.has_order !== undefined) {
      if (params.has_order === "1") {
        filters.push(`order_id IS NOT NULL`)
      } else {
        filters.push(`order_id IS NULL`)
      }
    }

    if (filters.length > 0) {
      sql += ` AND ${filters.join(" AND ")}`
    }

    return sql
  }
}
