import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { ReconciliationAdditionalRepository } from "./reconciliation-additional.repository.js"
import {
  GetAdditionalQueries,
  ResponseAdditional,
} from "./reconciliation-additional.schema.js"

export class ReconciliationAdditionalModule {
  constructor(
    private readonly reconciliationAdditionalRepo: ReconciliationAdditionalRepository
  ) {}

  async list(
    c: Context,
    param: GetAdditionalQueries,
    type: "action" | "reason" | "category"
  ) {
    const programId = c.get("programId") as number
    let result: ResponseAdditional = { count: 0, list: [] }
    switch (type) {
      case "action":
        result = await this.reconciliationAdditionalRepo.getListAction(
          c,
          programId,
          param
        )
        break
      case "reason":
        result = await this.reconciliationAdditionalRepo.getLisReason(
          c,
          programId,
          param
        )
        break
      case "category":
        result = await this.reconciliationAdditionalRepo.getLisCategory(
          c,
          param
        )
        break
      default:
        throw new Error(
          "Invalid type parameter. Must be 'action' or 'reason' or 'category'."
        )
    }
    return new PaginatedResponse(param, result.list, Number(result.count))
  }
}
