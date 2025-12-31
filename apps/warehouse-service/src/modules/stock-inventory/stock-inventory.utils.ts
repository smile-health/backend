import moment from "moment"
import {
  StockInventoryData,
  TransactionType,
} from "./stock-inventory.schema.js"
import { STOCK_INVENTORY_TRANSACTION_TYPE } from "@/common/constants/stock-inventory.js"
import { PeriodDTO } from "@/common/schemas/period.schema.js"
import { groupBy } from "es-toolkit"

export const FIXED_NUMBER = 2
export const DAY_IN_SECONDS = 86400

/**
 * Create composite key for grouping stock inventory data
 * Replaces the missing ehmm_id field from old schema
 */
export function createCompositeKey(item: StockInventoryData): string {
  return `${item.entity_id}_${item.master_material_id}`
}

/**
 * Generate period categories for both stock-availability and abnormal-stock
 * Shared utility function for period interval generation
 */
export function generatePeriodCategories(
  from: string,
  to: string,
  period: string = "month"
): { categories: PeriodDTO[]; durations: number[] } {
  // Input validation
  if (!from || !to) {
    throw new Error("From and to dates are required")
  }

  if (!["day", "week", "month"].includes(period)) {
    throw new Error(
      `Invalid period type: ${period}. Must be one of: day, week, month`
    )
  }

  // Map period types to match old codebase logic
  let unitPeriod: "day" | "week" | "month" = "day"
  let unitFormatDate = "YYYY-MM-DD"
  let strFormat = "YYYY MMM DD"

  if (period === "week") {
    unitPeriod = "week"
    unitFormatDate = "GGGG-WW"
    strFormat = "YYYY MMM DD"
  } else if (period === "month") {
    unitPeriod = "month"
    unitFormatDate = "YYYY-MM"
    strFormat = "YYYY MMM"
  }

  // Parse dates exactly like the old getIntervalPeriod function
  const fromMoment = moment(from, "YYYY-MM-DD")
  const toMoment = moment(to, "YYYY-MM-DD").endOf(unitPeriod)

  if (!fromMoment.isValid() || !toMoment.isValid()) {
    throw new Error("Invalid date format. Use YYYY-MM-DD format")
  }

  if (fromMoment.isAfter(toMoment)) {
    throw new Error("From date must be before or equal to to date")
  }

  // Generate intervals exactly like the old function
  let tempFrom = fromMoment.clone()
  const intervalPeriod: string[] = []
  const durations: number[] = []

  while (tempFrom.isBefore(toMoment)) {
    intervalPeriod.push(tempFrom.format(unitFormatDate))
    const start = moment(tempFrom)
    const end = moment(start).endOf(unitPeriod)
    durations.push(end.diff(start, "seconds"))
    tempFrom = tempFrom.add(1, unitPeriod)
  }

  // Convert to categories format for the new API structure
  const categories: PeriodDTO[] = intervalPeriod.map((periodLabel) => {
    const periodMoment = moment(periodLabel, unitFormatDate)
    const displayLabel = periodMoment.format(strFormat)

    return {
      id: periodLabel,
      label: displayLabel,
      selector: periodLabel,
      week_number: unitPeriod === "week" ? periodMoment.week() : null,
    }
  })

  return { categories, durations }
}

/**
 * Fill any missing periods for each entity-material group
 * Shared utility for both modules
 */
export function fillAndCalculateMissingData(
  stockData: StockInventoryData[],
  categories: PeriodDTO[],
  durations: number[],
  periodType: string,
  transactionType: TransactionType
): StockInventoryData[] {
  // Input validation
  if (!Array.isArray(stockData)) {
    throw new Error("Stock data must be a valid array")
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error("Categories array is required and cannot be empty")
  }

  if (!Array.isArray(durations) || durations.length === 0) {
    throw new Error("Durations array is required")
  }

  if (categories.length !== durations.length) {
    throw new Error("Categories and durations arrays must have the same length")
  }

  if (!["day", "week", "month"].includes(periodType)) {
    throw new Error(`Invalid period type: ${periodType}`)
  }

  if (
    !Object.values(STOCK_INVENTORY_TRANSACTION_TYPE).includes(transactionType)
  ) {
    throw new Error(`Invalid transaction type: ${transactionType}`)
  }

  const periods = categories.map((cat) => cat.selector)
  const copyPeriods = [...periods]
  if (periodType === "month" || periodType === "week") {
    copyPeriods.unshift("1970-01")
  } else {
    copyPeriods.unshift("1970-01-01")
  }

  // Group data by composite key (entity_id + master_material_id)
  const groupedData: Record<string, StockInventoryData[]> = groupBy(
    stockData,
    (item) => createCompositeKey(item)
  )

  // Fill in missing periods data points for each composite key group
  const filledData: StockInventoryData[] = []
  Object.keys(groupedData).forEach((compositeKey) => {
    const dataPerGroup = groupedData[compositeKey]
    if (!dataPerGroup || dataPerGroup.length === 0) {
      return // Skip empty groups
    }

    let latestExistingEntry: StockInventoryData | null = null
    let futureImmediateEntry: StockInventoryData | null =
      dataPerGroup[0] || null
    copyPeriods.forEach((period, index) => {
      const existingEntry = dataPerGroup.find((item) => item.period === period)

      if (!existingEntry && !latestExistingEntry && index === 0) {
        // First iteration for index 0 (1970 period we append earlier)
        const firstData = dataPerGroup[0]
        if (!firstData) {
          return // Skip if no data available
        }

        // 'null' to represent past & missing data
        const pastData: StockInventoryData = {
          ...firstData,
          period,
          opening_ehmm_balance: null,
          opening_change_qty: null,
          opening_ehmm_min: null,
          opening_ehmm_max: null,
          opening_offset_duration: null,
          opening_offset_frequency: null,
          middle_ehmm_duration: null,
          middle_ehmm_frequency: null,
          closing_ehmm_balance: null,
          closing_change_qty: null,
          closing_ehmm_min: null,
          closing_ehmm_max: null,
          closing_offset_duration: null,
          closing_offset_frequency: null,
          closing_current_stock_condition:
            firstData.opening_previous_stock_condition,
          future_immediate_balance_condition: futureImmediateEntry
            ? futureImmediateEntry.opening_current_stock_condition
            : null,
          total_duration_seconds: -1,
          total_frequency: -1,
        }

        latestExistingEntry = pastData
      } else if (!existingEntry && latestExistingEntry) {
        const duration = durations[index - 1] // Index - 1 because we push 1970 to the periods array earlier
        if (duration === undefined) {
          return // Skip if duration is not available
        }

        // Calculate missing period entry with the latest entry in mind
        const missingData = calculateMissingData(
          latestExistingEntry,
          period,
          duration,
          transactionType
        )

        latestExistingEntry = missingData
        filledData.push(missingData)
      } else if (existingEntry) {
        // Remove the appropiate existing entry from the dataPerGroup array
        const existingEntryIndex = dataPerGroup.indexOf(existingEntry)
        if (existingEntryIndex !== -1) {
          dataPerGroup.splice(existingEntryIndex, 1)
        }

        futureImmediateEntry = dataPerGroup[0] || null

        latestExistingEntry = {
          ...existingEntry,
          future_immediate_balance_condition: futureImmediateEntry
            ? futureImmediateEntry.opening_current_stock_condition
            : null,
        }
        filledData.push(latestExistingEntry)
      }
    })
  })

  return filledData
}

/**
 * Populate total_duration_seconds for missing data point
 * Helper function for fillAndCalculateMissingData
 */
function calculateMissingData(
  latestExistingEntry: StockInventoryData,
  period: string,
  duration: number,
  transactionType: TransactionType
): StockInventoryData {
  const {
    closing_current_stock_condition,
    future_immediate_balance_condition,
  } = latestExistingEntry

  // 'null' to represent past & missing data
  const missingData: StockInventoryData = {
    ...latestExistingEntry,
    period: period,
    opening_ehmm_balance: null,
    opening_change_qty: null,
    opening_ehmm_min: null,
    opening_ehmm_max: null,
    opening_offset_duration: null,
    opening_offset_frequency: null,
    middle_ehmm_duration: null,
    middle_ehmm_frequency: null,
    closing_ehmm_balance: null,
    closing_change_qty: null,
    closing_ehmm_min: null,
    closing_ehmm_max: null,
    closing_offset_duration: null,
    closing_offset_frequency: null,
    total_duration_seconds: -1,
    total_frequency: -1,
  }

  const previousEhmmBalanceCondition = closing_current_stock_condition

  if (
    checkPreviousEhmmBalance(
      previousEhmmBalanceCondition,
      future_immediate_balance_condition,
      transactionType
    )
  ) {
    missingData.total_duration_seconds = duration
    missingData.total_frequency = 0
  } else {
    missingData.total_duration_seconds = 0
    missingData.total_frequency = 0
  }

  return missingData
}

/**
 * Check if the balance meets the transaction type criteria
 * Helper function for calculateMissingData
 */
function checkPreviousEhmmBalance(
  previousEhmmBalanceCondition: string,
  futureImmediateBalanceCondition: string | null | undefined,
  transactionType: TransactionType
): boolean {
  if (
    transactionType === STOCK_INVENTORY_TRANSACTION_TYPE.ZERO &&
    previousEhmmBalanceCondition === STOCK_INVENTORY_TRANSACTION_TYPE.ZERO
  ) {
    return true
  } else if (
    transactionType === STOCK_INVENTORY_TRANSACTION_TYPE.MIN &&
    previousEhmmBalanceCondition === STOCK_INVENTORY_TRANSACTION_TYPE.MIN
  ) {
    return true
  } else if (
    transactionType === STOCK_INVENTORY_TRANSACTION_TYPE.MAX &&
    previousEhmmBalanceCondition === STOCK_INVENTORY_TRANSACTION_TYPE.MAX
  ) {
    return true
  } else if (
    transactionType === STOCK_INVENTORY_TRANSACTION_TYPE.NORMAL &&
    previousEhmmBalanceCondition === STOCK_INVENTORY_TRANSACTION_TYPE.ZERO &&
    futureImmediateBalanceCondition === STOCK_INVENTORY_TRANSACTION_TYPE.NORMAL
  ) {
    return true
  } else if (
    transactionType === STOCK_INVENTORY_TRANSACTION_TYPE.AVAILABILITY &&
    previousEhmmBalanceCondition !== STOCK_INVENTORY_TRANSACTION_TYPE.ZERO
  ) {
    return true
  }

  return false
}
