import { IdSchema } from "@smile/lib/types/param.js"
import { z } from "zod"

type ReportItem = {
  code: number
  name: string
  category_id: number
  created_at: string // ISO timestamp
}

type ReportCategory = {
  id: number
  title: string
  list: ReportItem[]
}

export type ListReportData = {
  data: ReportCategory[]
}

export interface ExportLogs {
  code: string
  export_category_id: number
  program_id: number
  month: number | null
  year: number | null
  lang: string
}

export const codeParamSchema = z.object({
  code: IdSchema.refine((val) => val >= 1 && val <= 60, {
    message: "validator.not_found",
  }),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export type codeParam = z.infer<typeof codeParamSchema>

export type ColumnExcel = {
  key: string | number
  header: string
  width: number
}

export interface ExcelProvinceOrRegencyItem {
  no: number
  provinceId: number
  provinceName: string
  regencyId?: number | null
  regencyName?: string | null
  grandTotal: number
  [materialId: string]: string | number | undefined | null
}

export interface ExcelProvinceOrRegencyDTO {
  provinceId: number
  provinceName: string
  regencyId?: number | null
  regencyName?: string | null
  materialId: number
  total: number
}

export type ExcelProvinceOrRegencyGroupedDTO = {
  [id: number]: ExcelProvinceOrRegencyDTO[]
}

export interface StockMaterialBacthDTO {
  provinceId: number
  provinceName: string
  regencyId: number
  regencyName: string
  entityName: string
  materialName: string
  activityName: string
  batchCode: string
  expirationDate: string | Date // tergantung apakah kamu ingin pakai string ISO atau Date object
  isVendor: boolean
  total: number
}

export interface ConfigProgram {
  material: ConfigMaterialItem
  color: string
}

export interface ConfigMaterialItem {
  is_hierarchy_enabled: boolean
  is_batch_enabled: boolean
}

export type DownloadByCodeLocal = {
  status: boolean
  filePath?: string
  filename?: string
}

export type DownloadByCodeMinio = {
  status: boolean
  buffer?: Buffer
  filename?: string
}

export type DownloadByCodeResult = DownloadByCodeLocal | DownloadByCodeMinio
