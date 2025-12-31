import { Context } from "hono"
import { execQuery } from "@/common/infrastructure/database/index.js"
import {
  AddRemoveDiscardBaseQueryParams,
  AddRemoveDiscardDataDTO,
  LastUpdatedDTO,
} from "./add-remove-discard.schema.js"
import { AddRemoveDiscardQuery } from "./add-remove-discard.query.js"
import { UsedFor } from "@/common/schemas/query-param.schema.js"

/**
 * Shared repository for add-remove-discard modules
 * Used by both add-remove-stock and stock-discard modules
 */
export class AddRemoveDiscardRepository {
  constructor(private readonly addRemoveDiscardQuery: AddRemoveDiscardQuery) {}

  /**
   * Unified method to get add-remove-discard data
   * @param c - Hono context
   * @param queryParams - Query parameters
   * @param usedFor - Used for material, entity, location, or review
   */
  async fetchAddRemoveDiscardData(
    c: Context,
    queryParams: AddRemoveDiscardBaseQueryParams,
    usedFor: UsedFor
  ): Promise<AddRemoveDiscardDataDTO[]> {
    const query = this.addRemoveDiscardQuery.buildAddRemoveDiscardQuery(
      c,
      queryParams,
      usedFor
    )

    const result = await execQuery<AddRemoveDiscardDataDTO[]>(query, queryParams)
    return result
  }

  /**
   * Get last updated timestamp
   * Shared between both modules
   */
  async fetchLastUpdated(): Promise<{ last_updated: string } | null> {
    const query = this.addRemoveDiscardQuery.buildLastUpdatedQuery()

    const result = await execQuery<LastUpdatedDTO[]>(query)
    const firstResult = result[0]

    if (!firstResult || !firstResult.last_updated) {
      return null
    }

    return { last_updated: firstResult.last_updated }
  }
}
