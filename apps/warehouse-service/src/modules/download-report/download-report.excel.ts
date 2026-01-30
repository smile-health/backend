import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import momentTZ from "moment-timezone"
import { convertFormatedDate } from "./download-report.util.js"
import {
  ColumnExcel,
  ExcelProvinceOrRegencyGroupedDTO,
  ExcelProvinceOrRegencyDTO,
  ExcelProvinceOrRegencyItem,
} from "./download-report.schema.js"

export class DownloadReportExcel extends BaseTemplate {
  constructor(startRow = 5, startSheet = 1, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }

  async setHeader(
    sheet: string,
    code?: string,
    printBy: string = "Administrator"
  ) {
    if (code) {
      this.addRows(
        sheet,
        [{ title: this.t("download-report.header.title." + code) }],
        1,
        "A"
      )
    }

    this.addRows(
      sheet,
      [
        {
          key: this.t("download-report.header.data_update"),
          value: this.getFormatDate(),
        },
      ],
      2,
      "A"
    )
    this.addRows(
      sheet,
      [
        {
          key: this.t("download-report.header.print_by"),
          value: printBy,
        },
      ],
      3,
      "A"
    )
  }

  getFormatDate(timezone?: string) {
    const currentTime = momentTZ().tz(timezone ?? this.timezone)
    const formatDate = convertFormatedDate(currentTime)
    return formatDate
  }

  async addRowWithHeaderMaterialAndKey(
    sheetName: string,
    excelTemplate: DownloadReportExcel,
    columns: ColumnExcel[],
    data: ExcelProvinceOrRegencyGroupedDTO
  ) {
    // Early return if no data
    if (!data || Object.keys(data).length === 0) {
      return
    }

    const dataToSave: ExcelProvinceOrRegencyItem[] = Object.values(data).map(
      (value, index) => {
        const result: ExcelProvinceOrRegencyItem = {
          no: index + 1,
          provinceId: 0,
          provinceName: "",
          grandTotal: 0,
        }

        // Handle both single object and array
        const rows: ExcelProvinceOrRegencyDTO[] = Array.isArray(value)
          ? value
          : [value]

        // Process rows and accumulate totals
        for (const row of rows) {
          const {
            provinceId,
            provinceName,
            regencyId = null,
            regencyName = null,
            materialId,
            total,
          }: ExcelProvinceOrRegencyDTO = row

          // Set province info (assuming all rows have same province)
          result.provinceId = provinceId
          result.provinceName = provinceName

          // Set regency info if exists
          if (regencyId && regencyName) {
            result.regencyId = regencyId
            result.regencyName = regencyName
          }

          // Add material total
          result[materialId] = (Number(result[materialId]) || 0) + total
          result.grandTotal += total
        }

        return result
      }
    )

    // Single call to addRows with pre-mapped data
    const keyNullif = new Set([
      "provinceId",
      "provinceName",
      "regencyId",
      "regencyName",
    ])

    const mappedRows = dataToSave.map((row) =>
      columns.map((col) =>
        keyNullif.has(col.key as string) ? row[col.key] : (row[col.key] ?? 0)
      )
    )

    await excelTemplate.addRows(
      sheetName,
      mappedRows,
      excelTemplate.getStartRow() + 1,
      "A"
    )
  }
}
