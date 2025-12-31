import moment from "moment"
import {
  PeriodDTO,
  QueryParamsWithPeriod,
} from "@/common/schemas/period.schema.js"

/**
 * Generate period periods with base format (id, label, selector, week_number)
 * Used by order-difference module
 *
 * @param queryParams - Query parameters containing from, to, and period
 * @returns Array of period objects with period information
 */
export function generatePeriods(
  queryParams: QueryParamsWithPeriod
): PeriodDTO[] {
  const { from, to, period = "month" } = queryParams
  const periods: PeriodDTO[] = []

  // Default date range if not provided
  const startDate = from ? moment(from) : moment().startOf("year")
  const endDate = to ? moment(to) : moment()

  const current = startDate.clone()
  let counter = 1

  while (current.isSameOrBefore(endDate)) {
    let label: string
    let id: string
    let week_number: number | null = null

    switch (period) {
      case "month":
        id = current.format("YYYY-MM")
        label = current.format("MMMM YYYY")
        current.add(1, "month")
        break
      case "week":
        week_number = current.week()
        id = `${current.year()}-W${current.week()}`
        label = `Week ${current.week()} ${current.format("YYYY")}`
        current.add(1, "week")
        break
      case "day":
      default:
        id = current.format("YYYY-MM-DD")
        label = current.format("DD MMMM YYYY")
        current.add(1, "day")
        break
    }

    periods.push({
      id,
      label,
      selector: `period${counter}`,
      week_number,
    })

    counter++
  }

  return periods
}
