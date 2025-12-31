import { MONTH_LABEL } from "@/common/constants/monitoring.js"
import { groupBy } from "es-toolkit"
import _ from "lodash"
import moment from "moment"

export function parsingArrIds(input: string | string[]): number[] {
  const items = Array.isArray(input) ? input : input.split(",")
  return items.map((id) => Number(id.trim())).filter((n) => !Number.isNaN(n))
}

export const sliceZeroValueMonths = <T>(
  list: T[],
  callback: (item: unknown) => unknown
) => {
  let firstNonZeroIndex = list.findIndex(callback)

  if (firstNonZeroIndex === -1) {
    firstNonZeroIndex = list.length
  }

  return list.slice(firstNonZeroIndex)
}

export const generateMonthYearSequence = (
  startDate: string,
  endDate: string
) => {
  const monthsAndYears: string[] = []
  const currentDate = moment(startDate).startOf("month")
  const endDateMoment = moment(endDate).startOf("month")

  while (currentDate.isSameOrBefore(endDateMoment)) {
    monthsAndYears.push(currentDate.format("YYYY-M"))
    currentDate.add(1, "months")
  }

  return monthsAndYears
}

export function groupSumMap<T>(
  data: T[],
  keyFn: (item: T) => string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapFn: (key: string, items: T[]) => any
) {
  return _.map(groupBy(data, keyFn), mapFn)
}

export function completeMonthSequence(
  source: { year: string; month: string; value: number }[],
  monthYearSequence: string[]
) {
  return monthYearSequence.map((monthYear) => {
    const [year, month] = monthYear.split("-")
    const match = source.find((el) => el.year === year && el.month === month)
    return {
      year,
      month: MONTH_LABEL[month ?? "0"],
      value: match?.value ?? 0,
    }
  })
}
