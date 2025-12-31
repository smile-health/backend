import { Context } from "hono"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { TransactionReasonQuery } from "./transaction-reason.query.js"
import {
  AddRemoveDiscardBaseQueryParams,
  TransactionReasonDTO,
} from "./add-remove-discard.schema.js"

/**
 * Shared transaction reason repository for add-remove-discard modules
 * Used by both add-remove-stock and stock-discard modules
 */
export class TransactionReasonRepository {
  constructor(
    private readonly transactionReasonQuery: TransactionReasonQuery
  ) {}

  /**
   * Fetch transaction reasons for series generation
   * @param c - Hono context
   * @param queryParams - AddRemoveDiscardBaseQueryParams
   */
  async fetchTransactionReasons(
    c: Context,
    queryParams: AddRemoveDiscardBaseQueryParams
  ): Promise<TransactionReasonDTO[]> {
    const query = this.transactionReasonQuery.buildTransactionReasonsQuery(
      c,
      queryParams
    )

    const result = await execQuery<TransactionReasonDTO[]>(query, queryParams)
    return result
  }
}
