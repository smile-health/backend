import moment from "moment"
import {
  ReconciliationBarReportDTO,
  ReconciliationEntityReportDTO,
  ReconciliationEntityReportResponseDataSchema,
} from "./reconciliation.schema.js"
import { EntityDTO } from "../entity/entity.schema.js"
import { z } from "zod"

export function getMonthLabel(integer: number): string {
  return moment({ month: integer - 1 }).format("YYYY-MM")
}

export function leadZeroNumber(num: number): string {
  return num < 10 ? `0${num}` : `${num}`
}

export function formatDecimal(num: number, decimalPlaces: number = 2): number {
  return parseFloat(num.toFixed(decimalPlaces))
}

export function formatBarData({
  reconByMonth,
  year,
  months,
}: {
  reconByMonth: ReconciliationBarReportDTO
  year: number
  months: number[]
  lang?: string
}) {
  const intervalPeriod: string[] = []
  const column: { label: string }[] = []
  const overview: { label: string; value: number }[] = []

  months.forEach((i) => {
    const month = leadZeroNumber(i)
    const data = reconByMonth.find((el) => el.year === year && el.month === i)

    const label = `${year}-${month}`
    const col = moment(label).format("MMM YYYY")

    intervalPeriod.push(label)
    column.push({ label: col })
    overview.push({
      label,
      value: data?.value || 0,
    })
  })

  return {
    intervalPeriod,
    data: overview,
    column,
    subColumn: ["value"],
  }
}

export function formatListEntityRecon({
  entities,
  reconciliations,
  months,
}: {
  entities: EntityDTO
  reconciliations: ReconciliationEntityReportDTO
  months: number[]
  lang?: string
}): {
  list: z.infer<typeof ReconciliationEntityReportResponseDataSchema>
  intervalPeriod: string[]
} {
  // const lang =
  const overviews: Record<string, number> = {}
  const intervalPeriod: string[] = []
  months.forEach((month) => {
    const formatMonth = getMonthLabel(month)
    overviews[formatMonth] = 0
    intervalPeriod.push(formatMonth)
  })

  const listEntity: z.infer<
    typeof ReconciliationEntityReportResponseDataSchema
  > = []
  entities.forEach((entity) => {
    const overviewPerEntity = JSON.parse(JSON.stringify(overviews))
    let total = 0
    reconciliations
      .filter((el) => el.entity_id === entity.id)
      .forEach((el) => {
        total += el.value
        overviewPerEntity[getMonthLabel(el.month)] = el.value ?? 0
      })

    listEntity.push({
      id: entity.id,
      name: entity.name,
      total: total,
      average: formatDecimal(total / months.length),
      months: overviewPerEntity,
    })
  })

  return {
    list: listEntity,
    intervalPeriod,
  }
}
