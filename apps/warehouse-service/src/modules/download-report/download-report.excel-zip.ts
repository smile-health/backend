import {
  MultiSheetZipExporter,
  MultiSheetZipExportOptions,
} from "@smile-health/lib/excel/multi-sheet-zip.js"
import {
  ColumnExcel,
  ExcelProvinceOrRegencyDTO,
  ExcelProvinceOrRegencyGroupedDTO,
  ExcelProvinceOrRegencyItem,
} from "./download-report.schema.js"
import { convertFormatedDate } from "./download-report.util.js"
import momentTZ from "moment-timezone"

export class ExcelZipExporter extends MultiSheetZipExporter {
  protected timezone: string
  constructor(options: MultiSheetZipExportOptions) {
    super(options)
    this.timezone = "UTC"
  }

  setTimezone(timezone?: string) {
    this.timezone = timezone ?? "UTC"
  }

  getFormatDate() {
    const currentTime = momentTZ().tz(this.timezone)
    const formatDate = convertFormatedDate(currentTime)
    return formatDate
  }

  async setHeader(
    id: string,
    sheet: string,
    transalation,
    code?: string,
    printBy: string = "Administrator"
  ) {
    if (code) {
      this.setColumns(
        id,
        sheet,
        [
          {
            header: transalation("download-report.header.title." + code),
            width: 10,
          },
        ],
        "A1"
      )
    }

    this.setColumns(
      id,
      sheet,
      [
        {
          header: transalation("download-report.header.data_update"),
          width: 10,
        },
        {
          header: this.getFormatDate(),
          width: 20,
        },
      ],
      "A2"
    )

    this.setColumns(
      id,
      sheet,
      [
        {
          header: transalation("download-report.header.print_by"),
          width: 10,
        },
        {
          header: printBy,
          width: 20,
        },
      ],
      "A3"
    )
  }

  async addRowWithHeaderMaterialAndKey(
    id: string,
    sheetName: string,
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

    const mappedObjects = dataToSave.map((row) => {
      const m = new Map<string, unknown>()
      for (const col of columns) {
        let k = String(col.key)
        if (/^\d+$/.test(k)) {
          k = `m_${k}` // prefix biar bukan numeric
        }
        m.set(
          k,
          keyNullif.has(col.key as string) ? row[col.key] : (row[col.key] ?? 0)
        )
      }
      return Object.fromEntries(m)
    })

    this.addRows(id, sheetName, [{}, {}, {}, ...mappedObjects])
  }
}
