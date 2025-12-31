import { Context } from "hono"
import {
  ReconciliationQueryParams,
  ReconciliationBarReportDTO,
  ReconciliationEntityReportDTO,
} from "./reconciliation.schema.js"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { ReconciliationQuery } from "./reconciliation.query.js"

export class ReconciliationRepository {
  constructor(private readonly reconciliationQuery: ReconciliationQuery) {}

  async fetchReconciliationBarReport(
    c: Context,
    queryParams: ReconciliationQueryParams
  ) {
    const reconciliationBarReportQuery =
      this.reconciliationQuery.buildReconciliationBarReportQuery(c, queryParams)

    return await execQuery<ReconciliationBarReportDTO>(
      reconciliationBarReportQuery,
      queryParams
    )
  }

  async fetchReconciliationEntityReport(
    c: Context,
    queryParams: ReconciliationQueryParams
  ) {
    const reconciliationEntityReportQuery =
      this.reconciliationQuery.buildReconciliationEntityReportQuery(
        c,
        queryParams
      )

    return await execQuery<ReconciliationEntityReportDTO>(
      reconciliationEntityReportQuery,
      queryParams
    )
  }
}
