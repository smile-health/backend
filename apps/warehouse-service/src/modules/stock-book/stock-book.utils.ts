import moment from "moment"
import _ from "lodash"
import {
  StockBookDTO,
  EntityMaterialActivityDTO,
  EntityMaterialActivityItemDTO,
  StockBookItemDTO,
  MapStockBookOptionDataDTO,
} from "./stock-book.schema.js"
import { group } from "@smile/lib/utils.js"
import {
  TRANSACTION_CHANGE_TYPE,
  TRANSACTION_TYPE,
} from "@/common/constants/transaction.js"
import { Context } from "hono"
import { ExcelExportOption } from "@/common/types/excel.js"
import { Column, Filter } from "@smile/lib/excel/types.js"

type StockBookExcelExportOption = ExcelExportOption & {
  rows: number
}

export function buildStockBookExportOption(
  c: Context,
  transactions: StockBookDTO,
  materials: EntityMaterialActivityDTO,
  month: string,
  year: string
) {
  const transactionRowData: StockBookDTO = []
  const closingBatchStocks: StockBookDTO = []
  const closingNonBatchStocks: StockBookDTO = []

  for (let index = 0; index < transactions.length; index++) {
    const transaction: StockBookItemDTO = transactions[index]!

    const transactionMonth = moment(transaction.transaction_created_at).format(
      "MM"
    )
    const transactionYear = moment(transaction.transaction_created_at).format(
      "YYYY"
    )

    const assignStock: StockBookItemDTO = { ...transaction, is_closing: true }

    // Fill batch closing stocks from a month before.
    // Push or overwrite till we find the latest stock per ema.
    if (
      transaction.batch_code &&
      new Date(transaction.transaction_created_at) <
        new Date(`${year}-${month}-01`)
    ) {
      const findBatchIndex = closingBatchStocks.findIndex(
        (el) =>
          el.material_id === assignStock.material_id &&
          el.batch_code === assignStock.batch_code &&
          el.stock_activity_id === assignStock.stock_activity_id
      )
      assignStock.quantity = transaction.transaction_closing_qty
      if (findBatchIndex === -1) {
        closingBatchStocks.push(assignStock)
      } else {
        closingBatchStocks[findBatchIndex] = assignStock
      }
    }

    // Fill non batch closing stocks from a month before.
    // Push or overwrite till we find the latest stock per ema.
    if (
      !transaction.batch_code &&
      new Date(transaction.transaction_created_at) <
        new Date(`${year}-${month}-01`)
    ) {
      const findMaterialIndex = closingNonBatchStocks.findIndex(
        (el) =>
          el.material_id === assignStock.material_id &&
          el.stock_activity_id === assignStock.stock_activity_id
      )

      assignStock.quantity = transaction.transaction_closing_qty
      if (findMaterialIndex === -1) {
        closingNonBatchStocks.push(assignStock)
      } else {
        closingNonBatchStocks[findMaterialIndex] = assignStock
      }
    }

    // Fill the rest of the current filtered month & year transaction
    if (transactionMonth === month && transactionYear === year) {
      /* If there are no past month transaction, we use the opening of the current filtered month & year
      transcation as the initial closing stock. Applied to batch and non batch stock below */
      if (transaction.batch_code) {
        const findBatch = closingBatchStocks.some(
          (el) =>
            el.batch_code === assignStock.batch_code &&
            el.material_id === assignStock.material_id &&
            el.stock_activity_id === assignStock.stock_activity_id
        )

        if (!findBatch) {
          assignStock.quantity = transaction.transaction_opening_qty
          closingBatchStocks.push(assignStock)
        }
      }

      if (!transaction.batch_code) {
        const findMaterial = closingNonBatchStocks.some(
          (el) =>
            el.material_id === assignStock.material_id &&
            el.stock_activity_id === assignStock.stock_activity_id
        )

        if (!findMaterial) {
          assignStock.quantity = transaction.transaction_opening_qty
          closingNonBatchStocks.push(assignStock)
        }
      }

      // Actual current filtered month & year transaction
      let customerName = ""
      const transctionTypeName = c.var.t(
        `transaction.type.${transaction.transaction_type_id}`
      )

      if (
        transaction.transaction_type_id === TRANSACTION_TYPE.ISSUES ||
        transaction.transaction_type_id === TRANSACTION_TYPE.CONSUMPTION
      ) {
        customerName = `${transaction.customer_name} ${transctionTypeName}`
      } else if (
        transaction.transaction_type_id === TRANSACTION_TYPE.RECEIVE ||
        transaction.transaction_type_id === TRANSACTION_TYPE.RETURN
      ) {
        customerName = `${transaction.vendor_name} ${transctionTypeName}`
      } else {
        customerName = `${transaction.entity_name} ${transctionTypeName}`
      }

      transactionRowData.push({
        ...transaction,
        entity_name: customerName,
        quantity: transaction.transaction_change_qty,
        is_closing: false,
      })
    }
  }

  const transactionsByMaterials = group(transactionRowData, "material_id")
  const closingBatchStocksByMaterials = group(closingBatchStocks, "material_id")
  const closingNonBatchStocksByMaterials = group(
    closingNonBatchStocks,
    "material_id"
  )

  const groupedMaterials = group(materials, "material_id")

  const options: StockBookExcelExportOption[] = []

  for (const [index, key] of Object.keys(groupedMaterials).entries()) {
    const materialSample: EntityMaterialActivityItemDTO =
      groupedMaterials[key]![0]!

    let stocks: StockBookDTO = []
    if (closingBatchStocks.length > 0) {
      stocks = closingBatchStocksByMaterials[key] ?? []
    }
    if (closingNonBatchStocks.length > 0) {
      stocks = [...stocks, ...(closingNonBatchStocksByMaterials[key] ?? [])]
    }

    const filters: Filter[] = [
      {
        key: c.var.t("stock_book.label.material"),
        value: materialSample.material_name,
      },
      {
        key: c.var.t("stock_book.label.material_type"),
        value: c.var.t(
          `material_type.label.${materialSample.material_type_name}`
        ),
      },
    ]

    const columns: Column[] = buildExcelExportColumns(c)

    const data: MapStockBookOptionDataDTO = mapStockBookExportOptionData(
      c,
      transactionsByMaterials[key],
      stocks
    )

    const option: StockBookExcelExportOption = {
      sheetName: `${index + 1} - ${materialSample.material_name}`,
      titleBar: c.var.t("stock_book.label.title"),
      filters,
      columns,
      data,
      rows: data && data.length > 0 ? data.length : 0,
    }

    options.push(option)
  }

  return _.orderBy(options, ["rows"], ["desc"])
}

function buildExcelExportColumns(c: Context) {
  const receiveT = c.var.t("stock_book.label.receive")
  const issueT = c.var.t("stock_book.label.issue")
  const institutionNameT = c.var.t("stock_book.label.institution_name")
  const dateT = c.var.t("stock_book.label.date")
  const amountT = c.var.t("stock_book.label.amount")
  const unitT = c.var.t("stock_book.label.unit")
  const batchCodeT = c.var.t("stock_book.label.batch_code")
  const edT = c.var.t("stock_book.label.ed")
  const activityT = c.var.t("stock_book.label.activity")
  const takenFromActivityT = c.var.t("stock_book.label.taken_from_activity")
  const cumulativeBalanceT = c.var.t("stock_book.label.cumulative_balance")
  const additionalInfoT = c.var.t("stock_book.label.additional_information")
  const reasonT = c.var.t("stock_book.label.reason")

  const columns: Column[] = [
    {
      key: "receive",
      header: receiveT,
      width: 20,
      children: [
        {
          key: "receive_entity_name",
          header: institutionNameT,
          width: 16,
        },
        {
          key: "receive_date",
          header: dateT,
          width: 16,
        },
        {
          key: "receive_quantity",
          header: amountT,
          width: 16,
        },
        {
          key: "receive_unit",
          header: unitT,
          width: 16,
        },
        {
          key: "receive_batched_code",
          header: batchCodeT,
          width: 16,
        },
        {
          key: "receive_expired_date",
          header: edT,
          width: 16,
        },
        {
          key: "receive_activity",
          header: activityT,
          width: 16,
        },
        {
          key: "receive_taken_from_activity",
          header: takenFromActivityT,
          width: 16,
        },
      ],
    },
    {
      key: "issue",
      header: issueT,
      width: 20,
      children: [
        {
          key: "issue_entity_name",
          header: institutionNameT,
          width: 16,
        },
        {
          key: "issue_date",
          header: dateT,
          width: 16,
        },
        {
          key: "issue_quantity",
          header: amountT,
          width: 16,
        },
        {
          key: "issue_unit",
          header: unitT,
          width: 16,
        },
        {
          key: "issue_batched_code",
          header: batchCodeT,
          width: 16,
        },
        {
          key: "issue_expired_date",
          header: edT,
          width: 16,
        },
        {
          key: "issue_activity",
          header: activityT,
          width: 16,
        },
        {
          key: "issue_taken_from_activity",
          header: takenFromActivityT,
          width: 16,
        },
        {
          key: "reason",
          header: reasonT,
          width: 16,
        },
        {
          key: "cumulative_balance",
          header: cumulativeBalanceT,
          width: 16,
        },
        {
          key: "additional_info",
          header: additionalInfoT,
          width: 16,
        },
      ],
    },
  ]

  return columns
}

function mapStockBookExportOptionData(
  c: Context,
  transactionsByMaterials: StockBookDTO = [],
  stocks: StockBookDTO = []
): MapStockBookOptionDataDTO {
  const data: MapStockBookOptionDataDTO = []

  if (transactionsByMaterials.length === 0 && stocks.length === 0) {
    return []
  }

  let cumulative = 0
  stocks.concat(transactionsByMaterials).forEach((item) => {
    if (
      item.transaction_change_type_id === TRANSACTION_CHANGE_TYPE.RECEIVE ||
      item.is_closing
    ) {
      const entityName = item.is_closing
        ? `${c.var.t("stock_book.label.remaining_stock")} ${item.entity_name}`
        : item.entity_name

      cumulative += item.quantity

      data.push({
        receive_entity_name: entityName,
        receive_date: moment(item.transaction_created_at).format(
          "YYYY-MM-DD HH:mm:ss"
        ),
        receive_quantity: Math.abs(item.quantity),
        receive_unit: c.var.t(
          `material_unit.label.${item.material_unit_of_consumption_name}`
        ),
        receive_batched_code: item.batch_code ?? "",
        receive_expired_date: moment(item.batch_expired_date).format(
          "YYYY-MM-DD HH:mm:ss"
        ),
        receive_activity: item.transaction_activity_name,
        receive_taken_from_activity: item.stock_activity_name,
        issue_entity_name: "",
        issue_date: "",
        issue_quantity: null,
        issue_unit: "",
        issue_batched_code: "",
        issue_expired_date: "",
        issue_activity: "",
        issue_taken_from_activity: "",
        reason: item.transaction_reason_name
          ? c.var.t(`transaction.reason.${item.transaction_reason_name}`)
          : "",
        cumulative_balance: cumulative,
        additional_info: item.transaction_other_reason,
      })
    } else {
      cumulative =
        item.transaction_change_type_id === TRANSACTION_CHANGE_TYPE.REMOVE
          ? cumulative - item.transaction_opening_qty + Math.abs(item.quantity)
          : cumulative - Math.abs(item.quantity)

      data.push({
        receive_entity_name: "",
        receive_date: "",
        receive_quantity: null,
        receive_unit: "",
        receive_batched_code: "",
        receive_expired_date: "",
        receive_activity: "",
        receive_taken_from_activity: "",
        issue_entity_name: item.entity_name,
        issue_date: moment(item.transaction_created_at).format(
          "YYYY-MM-DD HH:mm:ss"
        ),
        issue_quantity: Math.abs(item.quantity),
        issue_unit: c.var.t(
          `material_unit.label.${item.material_unit_of_consumption_name}`
        ),
        issue_batched_code: item.batch_code,
        issue_expired_date: moment(item.batch_expired_date).format(
          "YYYY-MM-DD HH:mm:ss"
        ),
        issue_activity: item.transaction_activity_name,
        issue_taken_from_activity: item.stock_activity_name,
        reason: item.transaction_reason_name
          ? c.var.t(`transaction.reason.${item.transaction_reason_name}`)
          : "",
        cumulative_balance: cumulative,
        additional_info: item.transaction_other_reason,
      })
    }
  })

  return data
}
