import { DATAMART_TRANSACTION } from "@/common/constants/monitoring.js"
import { QueryParamDateRangeValidator } from "@/common/validators/query-param-date-range.validator.js"
import { Context } from "hono"
import { z } from "zod"
import { MonitoringTransactionRepository } from "./transaction.repository.js"
import {
  MonitoringTransactionSchemaQueryParams,
  MonitoringTransactionSchemaQueryParamsSchema,
} from "./transaction.schema.js"

export class MonitoringTransactionMiddleware {
  constructor(
    private readonly queryParamDateRangeValidator: QueryParamDateRangeValidator,
    private readonly monitoringTransactionRepo: MonitoringTransactionRepository
  ) {}

  common = (c: Context) => {
    return MonitoringTransactionSchemaQueryParamsSchema.superRefine(
      async (
        queryParams: MonitoringTransactionSchemaQueryParams,
        ctx: z.RefinementCtx
      ) => {
        this.queryParamDateRangeValidator.checkToGreaterThanFrom(
          c,
          ctx,
          queryParams
        )
        this.queryParamDateRangeValidator.checkExpiredDateDependencies(
          c,
          ctx,
          queryParams
        )
        this.getColumnAggregationByTransactionType(c, queryParams)

        queryParams.transactionQuery!.joinTable = `LEFT JOIN raw_ws_materials as rwm FINAL ON t.dmm_parent_id = rwm.id AND rwm.program_id = ${c.var.programId}`
        queryParams.transactionQuery!.columnJoinTable =
          ", COALESCE(rwm.name, null) as material_parent_name, COALESCE(rwm.id, null) as material_parent_id"
      }
    )
  }

  private getColumnAggregationByTransactionType(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams
  ) {
    let transactionColumnCount: string
    let transactionColumnValue: string
    let transactionTypeTitle: string

    if (queryParams.transaction_type === 3) {
      transactionColumnCount = DATAMART_TRANSACTION.COLUMN.PENERIMAAN
      transactionColumnValue = DATAMART_TRANSACTION.COLUMN.PENERIMAAN_QTY
      transactionTypeTitle = c.var.t("transaction.type.3")
    } else if (queryParams.transaction_type === 4) {
      transactionColumnCount = DATAMART_TRANSACTION.COLUMN.CANCEL_DISCARD
      transactionColumnValue = DATAMART_TRANSACTION.COLUMN.CANCEL_DISCARD_QTY
      transactionTypeTitle = c.var.t("transaction.type.4")
    } else if (queryParams.transaction_type === 101) {
      transactionColumnCount =
        DATAMART_TRANSACTION.COLUMN.PENERIMAAN_PENGEMBALIAN
      transactionColumnValue =
        DATAMART_TRANSACTION.COLUMN.PENERIMAAN_PENGEMBALIAN_QTY
      transactionTypeTitle = c.var.t("transaction_type.id.101")
    } else if (queryParams.transaction_type === 102) {
      transactionColumnCount = DATAMART_TRANSACTION.COLUMN.PENGEMBALIAN
      transactionColumnValue = DATAMART_TRANSACTION.COLUMN.PENGEMBALIAN_QTY
      transactionTypeTitle = c.var.t("transaction_type.id.102")
    } else if (queryParams.transaction_type === 103) {
      transactionColumnCount = DATAMART_TRANSACTION.COLUMN.KONSUMSI
      transactionColumnValue = DATAMART_TRANSACTION.COLUMN.KONSUMSI_QTY
      transactionTypeTitle = c.var.t("transaction_type.id.10")
    } else if (queryParams.transaction_type === 7) {
      transactionColumnCount = DATAMART_TRANSACTION.COLUMN.ADD
      transactionColumnValue = DATAMART_TRANSACTION.COLUMN.ADD_QTY
      transactionTypeTitle = c.var.t("transaction_type.id.7")
    } else if (queryParams.transaction_type === 8) {
      transactionColumnCount = DATAMART_TRANSACTION.COLUMN.REMOVE
      transactionColumnValue = DATAMART_TRANSACTION.COLUMN.REMOVE_QTY
      transactionTypeTitle = c.var.t("transaction_type.id.8")
    } else {
      transactionColumnCount = DATAMART_TRANSACTION.COLUMN.PENGELUARAN
      transactionColumnValue = DATAMART_TRANSACTION.COLUMN.PENGELUARAN_QTY
      transactionTypeTitle = c.var.t("transaction_type.id.2")
    }

    queryParams.transactionQuery = {
      column: [transactionColumnCount, transactionColumnValue],
      orderBy: queryParams.information_type === 1 ? "count DESC" : "value DESC",
      transaction_type_title: transactionTypeTitle,
    }
  }
}
