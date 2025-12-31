import { AgeGroupData } from "./microplanning-dashboard.schema.js"

export const AGE_GROUPS = [
  "_0-2",
  "_2.1-12",
  "_12.1-24",
  "_84",
  "_96",
  "_132",
  "_144",
  "_180-480",
] as const

export type AgeGroupKey = (typeof AGE_GROUPS)[number]

export function calculateAgeInMonths(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth)
  const now = new Date()

  const yearsDiff = now.getFullYear() - dob.getFullYear()
  const monthsDiff = now.getMonth() - dob.getMonth()
  const daysDiff = now.getDate() - dob.getDate()

  let totalMonths = yearsDiff * 12 + monthsDiff

  if (daysDiff < 0) {
    totalMonths--
  }

  return totalMonths
}

export function getAgeGroup(ageInMonths: number): AgeGroupKey | null {
  if (ageInMonths >= 0 && ageInMonths <= 2) return "_0-2"
  if (ageInMonths > 2 && ageInMonths <= 12) return "_2.1-12"
  if (ageInMonths > 12 && ageInMonths <= 24) return "_12.1-24"
  if (ageInMonths === 84) return "_84"
  if (ageInMonths === 96) return "_96"
  if (ageInMonths === 132) return "_132"
  if (ageInMonths === 144) return "_144"
  if (ageInMonths >= 180 && ageInMonths <= 480) return "_180-480"
  return null
}

export function initializeAgeGroups(): AgeGroupData {
  const ordered: AgeGroupData = {
    "_0-2": 0,
    "_2.1-12": 0,
    "_12.1-24": 0,
    _84: 0,
    _96: 0,
    _132: 0,
    _144: 0,
    "_180-480": 0,
  }
  return ordered
}

export function groupByAgeGroup(
  data: Array<{ date_of_birth?: string; birth_date?: string }>
): AgeGroupData {
  const counts: Record<string, number> = {}

  data.forEach((item) => {
    const birthDate = item.date_of_birth || item.birth_date
    if (!birthDate) return

    const ageInMonths = calculateAgeInMonths(birthDate)
    const ageGroup = getAgeGroup(ageInMonths)
    if (ageGroup) {
      counts[ageGroup] = (counts[ageGroup] || 0) + 1
    }
  })

  return {
    "_0-2": counts["_0-2"] || 0,
    "_2.1-12": counts["_2.1-12"] || 0,
    "_12.1-24": counts["_12.1-24"] || 0,
    _84: counts["_84"] || 0,
    _96: counts["_96"] || 0,
    _132: counts["_132"] || 0,
    _144: counts["_144"] || 0,
    "_180-480": counts["_180-480"] || 0,
  }
}

export function sumAgeGroupData(
  target: AgeGroupData,
  source: AgeGroupData
): void {
  Object.keys(source).forEach((age) => {
    target[age] = (target[age] || 0) + (source[age] || 0)
  })
}

export function calculateTotal(ageGroupData: AgeGroupData): number {
  return Object.values(ageGroupData).reduce((sum, count) => sum + count, 0)
}
