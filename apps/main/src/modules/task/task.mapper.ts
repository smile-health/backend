import { UserBasicInfoMap } from "../user/user.mapper.js"
import { TaskDetailResult, TaskListRow } from "./task.repository.js"

/**
 * Formats month distribution JSON/CSV string into localized month abbreviations.
 */
export function formatMonthDistribution(
  raw: string | null | undefined,
  language: string | undefined
) {
  if (!raw) return []

  let months: number[] = []

  try {
    const parsed = JSON.parse(raw)
    const values = Array.isArray(parsed) ? parsed : [parsed]
    months = values
      .map(Number)
      .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)

    if (!months.length) {
      throw new Error("Invalid month distribution JSON")
    }
  } catch {
    months = String(raw)
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
  }

  if (!months.length) return []

  const locale = language || "en"
  const formatter = new Intl.DateTimeFormat(locale, { month: "short" })

  return months.map((m) =>
    formatter.format(new Date(2000, m - 1, 1)).toUpperCase()
  )
}

/**
 * Maps a task list row to API response format.
 */
export function toListResponse(
  row: TaskListRow,
  userMap: UserBasicInfoMap,
  totalProvince: number,
  language: string | undefined
) {
  const provinceCount = Number(row.coverage_province_count ?? 0)
  const provinceValue =
    totalProvince > 0 && provinceCount === totalProvince ? 0 : provinceCount

  return {
    id: row.id,
    code: row.code,
    material: {
      id: row.material_id,
      name: row.material_name,
    },
    activity: {
      id: row.activity_id,
      name: row.activity_name,
    },
    ip: row.ip,
    month_distribution: formatMonthDistribution(
      row.month_distribution,
      language
    ),
    target_group: {
      id: row.target_group_id,
      name: row.target_group_name,
    },
    number_of_dose: Number(row.number_of_dose),
    coverage: {
      id: row.id,
      province_count: provinceValue,
    },
    user_updated_at: row.updated_at,
    user_updated_by: row.updated_by ? (userMap[row.updated_by] ?? null) : null,
  }
}

/**
 * Maps task detail result to API response format.
 */
export function toDetailResponse(result: TaskDetailResult) {
  const base = result.rows[0]!

  const coverageMap = new Map<
    number,
    {
      id: number
      province: { id: number; name: string | null }
      coverage_number: number
    }[]
  >()

  result.coverages.forEach((item) => {
    const cov = {
      id: item.id,
      province: {
        id: item.province_id,
        name: item.province_name,
      },
      coverage_number: Number(item.coverage_number ?? 0),
    }

    const list = coverageMap.get(item.target_group_id) ?? []
    list.push(cov)
    coverageMap.set(item.target_group_id, list)
  })

  return {
    id: base.id,
    code: base.code,
    program_plan_id: base.program_plan_id,
    material: {
      id: base.material_id,
      name: base.material_name,
    },
    activity: {
      id: base.activity_id,
      name: base.activity_name,
    },
    ip: base.ip,
    month_distribution: base.month_distribution ?? "",
    target_groups: [
      {
        id: Number(base.target_group_id),
        name: base.target_group_name,
        number_of_dose: Number(base.number_of_dose ?? 0),
        coverages: coverageMap.get(Number(base.target_group_id)) ?? [],
      },
    ],
  }
}
