import { Context } from "hono"
import { AddRemoveDiscardBaseQueryParams } from "./add-remove-discard.schema.js"

/**
 * Shared transaction reason query for add-remove-discard modules
 * Used by both add-remove-stock and stock-discard modules
 */
export class TransactionReasonQuery {
  constructor() {}

  /**
   * Build query to fetch transaction reasons for series generation
   * @param c - Hono context
   * @param queryParams - AddRemoveDiscardBaseQueryParams
   */
  buildTransactionReasonsQuery(
    c: Context,
    queryParams: AddRemoveDiscardBaseQueryParams
  ): string {
    let filters = ""

    // Base filters
    filters += ` AND tr.deleted_at IS NULL`
    filters += ` AND tr.status = 1`

    // Optional transaction type filter
    if (queryParams.transaction_type && queryParams.transaction_type.length > 0) {
      filters += ` AND tr.transaction_type_id IN {transaction_type:Array(Int64)}`
    }

    // Optional reason ids filter
    if (queryParams.reason_ids && queryParams.reason_ids.length > 0) {
      filters += ` AND tr.id IN {reason_ids:Array(Int64)}`
    }

    const query = `
      SELECT
        tr.id,
        tr.title
      FROM raw_ws_transaction_reasons tr FINAL
      WHERE 1=1
        ${filters}
      ORDER BY tr.id
    `

    return query.trim()
  }
}
