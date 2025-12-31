import { WorkbookNotFound } from "@smile/lib/error-excel.js"
import { XLSXPopulateProcessor } from "@smile/lib/excel/processor.xlsxpopulate.js"
import { Context } from "hono"
import { isEmpty } from "lodash"
import moment from "moment"
import momentTZ from "moment-timezone"
import {
  ActivityByEntityDTO,
  UserActivityQueryParams,
} from "./user-activity.schema.js"
import { MaterialDTO } from "../material/material.schema.js"

export class UserActivityTemplateExcel extends XLSXPopulateProcessor {
  constructor(startRow = 10, startSheet = 1) {
    super(startRow, startSheet)
  }

  async generateUserActivityEntity(
    c: Context,
    title: string,
    rows: ActivityByEntityDTO[],
    materials: MaterialDTO,
    queryParams: Pick<
      UserActivityQueryParams,
      | "activity_ids"
      | "material_ids"
      | "province_id"
      | "regency_id"
      | "from"
      | "is_customer_activity"
    >,
    intervalPeriod?: string[]
  ) {
    await this.initSheet(title)

    const workbook = this.workbook
    const sheet = this.sheet

    sheet.cell("A1").value(title)
    sheet.cell("A1").style({ bold: true, horizontalAlignment: "center" })

    sheet.cell("A2").value(c.var.t("common.year"))
    sheet.cell("B2").value(moment(queryParams.from).format("YYYY"))
    sheet.cell("A3").value(c.var.t("common.month"))
    sheet.cell("B3").value(moment(queryParams.from).format("MMMM"))
    sheet.cell("A4").value(c.var.t("common.entityorfaskes"))
    sheet.cell("B4").value("")
    sheet.cell("A5").value(c.var.t("common.activity"))
    sheet
      .cell("B5")
      .value(queryParams.activity_ids ? rows[0]?.activity_name : "")
    sheet.cell("A6").value(c.var.t("common.material"))
    const materialName =
      Array.isArray(materials) && materials.length > 0
        ? materials.map((mat) => mat.name).join(", ")
        : c.var.t("common.all")
    sheet.cell("B6").value(queryParams.material_ids ? materialName : "")

    const headerRow = 8
    const kolomNo = "A"
    const kolomNamaProvinsi = "B"
    const kolomNamaKabko = "C"
    const kolomIdEntitas = "D"
    const kolomNamaEntitas = "E"
    
    // Conditional customer columns
    const kolomCustomerId = queryParams.is_customer_activity ? "F" : undefined
    const kolomCustomerName = queryParams.is_customer_activity ? "G" : undefined
    const kolomKegiatan = queryParams.is_customer_activity ? "H" : "F"

    sheet.cell(`${kolomNo}${headerRow}`).value("No")
    sheet
      .cell(`${kolomNamaProvinsi}${headerRow}`)
      .value(c.var.t("common.province"))
    sheet.cell(`${kolomNamaKabko}${headerRow}`).value(c.var.t("common.regency"))
    sheet
      .cell(`${kolomIdEntitas}${headerRow}`)
      .value(c.var.t("common.entity_id"))
    sheet
      .cell(`${kolomNamaEntitas}${headerRow}`)
      .value(c.var.t("entity_customer.label.entity_name"))
    
    // Add customer columns conditionally
    if (queryParams.is_customer_activity && kolomCustomerId && kolomCustomerName) {
      sheet
        .cell(`${kolomCustomerId}${headerRow}`)
        .value(c.var.t("common.customer_id"))
      sheet
        .cell(`${kolomCustomerName}${headerRow}`)
        .value(c.var.t("common.customer_name"))
    }
    
    sheet.cell(`${kolomKegiatan}${headerRow}`).value(c.var.t("common.activity"))
    // Calculate the starting column for date headers (after all entity/customer columns)
    const dateStartCol = queryParams.is_customer_activity ? 9 : 7
    
    sheet
      .cell(headerRow, dateStartCol)
      .value(
        moment(queryParams.from).format("MMMM") +
          " " +
          moment(queryParams.from).format("YYYY")
      )
      .style({ horizontalAlignment: "center", bold: true })
    sheet
      .range(headerRow, dateStartCol, headerRow, intervalPeriod!.length + dateStartCol - 3)
      .merged(true)

    for (let day = 1; day <= intervalPeriod!.length; day++) {
      const colIndex = dateStartCol + (day - 1)
      const dayString = day.toString().padStart(2, "0")
      sheet.cell(headerRow + 1, colIndex).value(dayString)
      sheet.column(colIndex).width(5)
      sheet
        .cell(headerRow + 1, colIndex)
        .style({ horizontalAlignment: "center", bold: true })
    }

    const colAfterDate = intervalPeriod!.length + dateStartCol - 1
    const kolomTotalHariAktif = colAfterDate + 1
    const kolomTotalHariTidakAktif = colAfterDate + 2
    const kolomTotalFrekuensi = colAfterDate + 3
    const kolomRataRataFrekuensi = colAfterDate + 4

    sheet
      .cell(headerRow - 5, kolomTotalHariAktif)
      .value(c.var.t("entity.label.province"))
    const valueProvince = queryParams.province_id ? rows[0]?.province_name : ""
    sheet.cell(headerRow - 5, kolomTotalHariTidakAktif).value(valueProvince)
    sheet
      .cell(headerRow - 4, kolomTotalHariAktif)
      .value(c.var.t("entity.label.regency"))
    const valueRegency = queryParams.regency_id ? rows[0]?.regency_name : ""
    sheet.cell(headerRow - 4, kolomTotalHariTidakAktif).value(valueRegency)

    sheet
      .cell(headerRow, kolomTotalHariAktif)
      .value(c.var.t("user-activity.export.total_active_days"))
    sheet
      .cell(headerRow, kolomTotalHariTidakAktif)
      .value(c.var.t("user-activity.export.total_inactive_days"))
    sheet
      .cell(headerRow, kolomTotalFrekuensi)
      .value(c.var.t("user-activity.export.total_frequency_expenditure"))
    sheet
      .cell(headerRow, kolomRataRataFrekuensi)
      .value(c.var.t("user-activity.export.average_frequency"))
    ;[
      kolomTotalHariAktif,
      kolomTotalHariTidakAktif,
      kolomTotalFrekuensi,
      kolomRataRataFrekuensi,
    ].forEach((col) => {
      sheet
        .cell(headerRow, col)
        .style({ bold: true, horizontalAlignment: "center" })
      sheet.column(col).width(12)
    })

    let currentRow = headerRow + 2
    let count = 0
    for (const entitas of rows) {
      count++
      sheet.cell(`A${currentRow}`).value(count)
      sheet.cell(`B${currentRow}`).value(entitas.province_name)
      sheet.cell(`C${currentRow}`).value(entitas.regency_name)
      sheet.cell(`D${currentRow}`).value(entitas.id)
      sheet.cell(`E${currentRow}`).value(entitas.name)
      
      // Add customer data conditionally
      if (queryParams.is_customer_activity && kolomCustomerId && kolomCustomerName) {
        sheet.cell(`${kolomCustomerId}${currentRow}`).value(entitas.customer_id || "")
        sheet.cell(`${kolomCustomerName}${currentRow}`).value(entitas.customer_name || "")
      }
      
      sheet.cell(`${kolomKegiatan}${currentRow}`).value(entitas.activity_name)

      for (let i = 0; i <= intervalPeriod!.length; i++) {
        const dateStr = intervalPeriod![i]
        const colIndex = dateStartCol + i
        const value = entitas.overview![dateStr!] ?? 0

        sheet.cell(currentRow, colIndex).value(value)
        sheet
          .cell(currentRow, colIndex)
          .style({ horizontalAlignment: "center" })
      }

      sheet
        .cell(currentRow, kolomTotalHariAktif)
        .value(entitas.total_active_days)
      sheet
        .cell(currentRow, kolomTotalHariTidakAktif)
        .value(entitas.total_inactive_days)
      sheet.cell(currentRow, kolomTotalFrekuensi).value(entitas.total_frequency)
      sheet
        .cell(currentRow, kolomRataRataFrekuensi)
        .value(entitas.average_frequency)

      currentRow++
    }

    const lastDataRow = currentRow - 1
    const titleMergeEndCol = intervalPeriod!.length + dateStartCol + 2
    sheet.range(1, 1, 1, titleMergeEndCol).merged(true)
    const tableRange = sheet.range(
      headerRow,
      1,
      lastDataRow,
      intervalPeriod!.length + dateStartCol + 3
    )
    tableRange.style({
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    })

    if (!workbook) {
      throw new WorkbookNotFound()
    }

    const currentTime = momentTZ().tz(c.req.header("Timezone") ?? "UTC")
    const formatDate =
      currentTime.format("MM-DD-YYYY HH_mm_ss") +
      " GMT" +
      currentTime.format("Z").replace(":00", "")

    const provincePart = !isEmpty(valueProvince) ? `- ${valueProvince} ` : ""
    const regencyPart = !isEmpty(valueRegency) ? `- ${valueRegency} ` : ""
    const filename =
      title +
      " " +
      provincePart +
      regencyPart +
      formatDate +
      "_" +
      c.req.header("Accept-Language")

    return {
      filename,
      buffer: (await workbook.outputAsync("buffer")) as ArrayBuffer,
    }
  }
}
