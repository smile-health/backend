import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const LocationTypeParamsSchema = z.object({
  type: z
    .string()
    .refine((v) => ["province", "city", "district", "village"].includes(v), {
      message: "type must be one of: province, city, district, village",
    }),
})

const parseLocationIds = (val: string | string[] | undefined): number[] => {
  if (!val) return []

  const parseString = (str: string): number[] => {
    const trimmed = str.trim()

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed)
        return Array.isArray(parsed)
          ? parsed.map(Number).filter((i) => !isNaN(i))
          : []
      } catch {
        return []
      }
    }

    return trimmed
      .split(",")
      .map((i) => Number(i.trim()))
      .filter((i) => !isNaN(i))
  }

  const ids = Array.isArray(val) ? val : [val]
  return ids.flatMap(parseString)
}

const getDefaultDate = (type: "start" | "end"): string => {
  const currentYear = new Date().getFullYear()
  return type === "start" ? `${currentYear}-01-01` : `${currentYear}-12-31`
}

export const TargetConsumptionQueriesSchema = PaginationQueriesSchema.extend({
  page: z
    .string()
    .optional(),
  paginate: z
    .string()
    .optional(),
  offset: z.number().optional(),
  province_ids: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform(parseLocationIds),
  city_ids: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform(parseLocationIds),
  district_ids: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform(parseLocationIds),
  village_ids: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform(parseLocationIds),
  gender: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined
      const num = Number(val)
      return num === 1 || num === 2 ? num : undefined
    })
    .refine((val) => val === undefined || val === 1 || val === 2, {
      message: "gender must be 1 (male) or 2 (female)",
    }),
  target_group: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      const result = parseLocationIds(val)
      return result.length > 0 ? result : undefined
    }),
  material_id: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      const result = parseLocationIds(val)
      return result.length > 0 ? result : undefined
    }),
  batch_ids: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      const result = parseLocationIds(val)
      return result.length > 0 ? result : undefined
    }),
  start_date: z
    .string()
    .optional()
    .transform((val) => val || getDefaultDate("start")),
  end_date: z
    .string()
    .optional()
    .transform((val) => val || getDefaultDate("end")),
})

export type LocationTypeParams = z.infer<typeof LocationTypeParamsSchema>
export type TargetConsumptionQueries = z.infer<
  typeof TargetConsumptionQueriesSchema
>

export interface AgeGroupData {
  [key: string]: number
}

export interface RegionDetail {
  region: string
  total_target: number
  total_consumption: number
  details: {
    target: AgeGroupData
    consumption: AgeGroupData
  }
}

export interface DashboardResponse {
  summary: {
    total_target: number
    total_consumption: number
    start_date: string
    end_date: string
  }
  data: RegionDetail[]
  aggregate: {
    region: string
    total_target: number
    total_consumption: number
    details: {
      target: AgeGroupData
      consumption: AgeGroupData
    }
  }
}

export interface VaccineInfo {
  name: string
  ageGroup: string
  key: string
}

export interface ColumnGroup {
  group: string
  vaccines: VaccineInfo[]
}

export interface TotalTargetData {
  region: string
  [key: string]: string | number
}

export interface TotalTargetResponse {
  columns: ColumnGroup[]
  data: TotalTargetData[]
}

export const BatchByMaterialIdParamsSchema = z.object({
  material_id: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      const result = parseLocationIds(val)
      return result.length > 0 ? result : undefined
    }),
})

export type BatchByMaterialIdParams = z.infer<typeof BatchByMaterialIdParamsSchema>
