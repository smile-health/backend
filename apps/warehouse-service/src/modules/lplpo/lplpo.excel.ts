import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import moment from "moment"
import { TFunction } from "i18next"

export class LplpoExcel extends BaseTemplate {
  protected t: TFunction

  constructor(
    translator: TFunction,
    startRow = 12,
    startSheet = 1,
    processor = PROCESSOR.XLSXPOPULATE
  ) {
    super(startRow, startSheet, processor)
    this.t = translator
  }

  async setHeader(
    sheet: string,
    dinas: string,
    satuanKerja: string,
    kabupaten: string,
    propinsi: string,
    kegiatan: string,
    bulan: string,
    tahun: string
  ) {
    // Access workbook directly from processor
    const workbook = (this.processor as any).workbook
    if (!workbook) {
      await this.initSheet(sheet)
    }

    // Ensure sheet exists, if not create it
    let activeSheet = (this.processor as any).workbook.sheet(sheet)
    if (!activeSheet) {
      // Sheet doesn't exist, add it
      activeSheet = (this.processor as any).workbook.addSheet(sheet)
    }

    // Title
    activeSheet.cell("A1").value(this.t("lplpo.title"))
    activeSheet.range("A1:W1").merged(true).style({
      bold: true,
      horizontalAlignment: "center",
      verticalAlignment: "center",
      fontSize: 14,
    })

    // Header Information (Left side)
    activeSheet.cell("A3").value(this.t("lplpo.header.dinas"))
    activeSheet.cell("B3").value(": " + dinas)
    activeSheet.cell("A4").value(this.t("lplpo.header.satuan_kerja"))
    activeSheet.cell("B4").value(": " + satuanKerja)
    activeSheet.cell("A5").value(this.t("lplpo.header.kabupaten"))
    activeSheet.cell("B5").value(": " + kabupaten)
    activeSheet.cell("A6").value(this.t("lplpo.header.propinsi"))
    activeSheet.cell("B6").value(": " + propinsi)

    // Header Information (Right side)
    activeSheet.cell("O3").value(this.t("lplpo.header.kegiatan"))
    activeSheet.cell("P3").value(": " + kegiatan)
    activeSheet.cell("O4").value(this.t("lplpo.header.bulan"))
    activeSheet.cell("P4").value(": " + bulan)
    activeSheet.cell("O5").value(this.t("lplpo.header.tahun"))
    activeSheet.cell("P5").value(": " + tahun)

    // Table Headers - Row 9
    activeSheet.cell("A9").value(this.t("lplpo.table.no"))
    activeSheet.cell("B9").value(this.t("lplpo.table.nama_obat"))
    activeSheet.cell("C9").value(this.t("lplpo.table.satuan"))

    // STOK AWAL - D column merged 9-10
    activeSheet.cell("D9").value(this.t("lplpo.table.stok_awal"))
    activeSheet.range("D9:D10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })

    // PERIODE LALU - E-F merged in row 9
    activeSheet.cell("E9").value(this.t("lplpo.table.periode_lalu"))
    activeSheet.range("E9:F9").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })
    activeSheet.cell("E10").value(this.t("lplpo.table.penerimaan"))
    activeSheet.cell("F10").value(this.t("lplpo.table.pemakaian"))

    // STOK AKHIR - G column merged 9-10
    activeSheet.cell("G9").value(this.t("lplpo.table.stok_akhir"))
    activeSheet.range("G9:G10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })

    // PERIODE DISTRIBUSI (HARI) - with yellow header, merged 9-10
    activeSheet.cell("H9").value(this.t("lplpo.table.periode_distribusi_hari"))
    activeSheet.range("H9:H10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
      fill: "FFFF00",
    })

    // BESARAN PENYANGGA (X) - with yellow header, merged 9-10
    activeSheet.cell("I9").value(this.t("lplpo.table.besaran_penyangga_x"))
    activeSheet.range("I9:I10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
      fill: "FFFF00",
    })

    // WAKTU TUNGGU (HARI) - with yellow header, merged 9-10
    activeSheet.cell("J9").value(this.t("lplpo.table.waktu_tunggu_hari"))
    activeSheet.range("J9:J10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
      fill: "FFFF00",
    })

    // STOK OPTIMUM - K column merged 9-10
    console.log(
      "Setting STOK OPTIMUM header",
      this.t("lplpo.table.stok_optimum")
    )
    activeSheet.cell("K9").value(this.t("lplpo.table.stok_optimum"))
    activeSheet.range("K9:K10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })

    // PERMINTAAN
    activeSheet.cell("L9").value(this.t("lplpo.table.permintaan"))
    activeSheet.range("L9:L10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })

    // PEMBERIAN
    activeSheet.cell("M9").value(this.t("lplpo.table.pemberian"))
    activeSheet.range("M9:M10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })

    // SUMBER DANA
    activeSheet.cell("N9").value(this.t("lplpo.table.sumber_dana"))
    activeSheet.range("N9:R9").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })
    activeSheet.cell("N10").value(this.t("lplpo.table.apbn"))
    activeSheet.cell("O10").value(this.t("lplpo.table.dak"))
    activeSheet.cell("P10").value(this.t("lplpo.table.apbd_1"))
    activeSheet.cell("Q10").value(this.t("lplpo.table.apbd_2"))
    activeSheet.cell("R10").value(this.t("lplpo.table.lainnya"))

    // Batch
    activeSheet.cell("S9").value(this.t("lplpo.table.batch"))
    activeSheet.range("S9:S10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })

    // ED
    activeSheet.cell("T9").value(this.t("lplpo.table.ed"))
    activeSheet.range("T9:T10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })

    // KETERANGAN
    activeSheet.cell("U9").value(this.t("lplpo.table.keterangan"))
    activeSheet.range("U9:U10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })

    // Merge cells for NO, NAMA OBAT, SATUAN
    activeSheet.range("A9:A10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })
    activeSheet.range("B9:B10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })
    activeSheet.range("C9:C10").merged(true).style({
      horizontalAlignment: "center",
      verticalAlignment: "center",
    })

    // Apply border and style to all header cells
    const headerRange = activeSheet.range("A9:U10")
    headerRange.style({
      bold: true,
      horizontalAlignment: "center",
      verticalAlignment: "center",
      border: true,
    })

    // Add numbering row (Row 11: 1-21)
    for (let i = 0; i < 21; i++) {
      const columnLetter = String.fromCharCode(65 + i) // A=65, B=66, etc.
      activeSheet.cell(`${columnLetter}11`).value(i + 1)
      activeSheet.cell(`${columnLetter}11`).style({
        bold: true,
        horizontalAlignment: "center",
        verticalAlignment: "center",
        border: true,
      })
    }

    // Set column widths
    activeSheet.column("A").width(5)
    activeSheet.column("B").width(30)
    activeSheet.column("C").width(10)
    activeSheet.column("D").width(10)
    activeSheet.column("E").width(12)
    activeSheet.column("F").width(12)
    activeSheet.column("G").width(12)
    activeSheet.column("H").width(14)
    activeSheet.column("I").width(14)
    activeSheet.column("J").width(14)
    activeSheet.column("K").width(10)
    activeSheet.column("L").width(12)
    activeSheet.column("M").width(12)
    activeSheet.column("N").width(8)
    activeSheet.column("O").width(8)
    activeSheet.column("P").width(8)
    activeSheet.column("Q").width(8)
    activeSheet.column("R").width(10)
    activeSheet.column("S").width(15)
    activeSheet.column("T").width(12)
    activeSheet.column("U").width(15)

    return this
  }

  async setRows(sheet: string, rows: AsyncIterableIterator<object> | object[]) {
    return this.addRows(sheet, rows)
  }

  async addMaterialRows(sheet: string, data: any[]) {
    // Access workbook directly from processor
    const workbook = (this.processor as any).workbook
    if (!workbook) {
      throw new Error("Workbook not initialized")
    }

    const activeSheet = workbook.sheet(sheet)
    let currentRow = 12 // Start after header and numbering row

    for (const parentItem of data) {
      // Add parent material row
      activeSheet.cell(`A${currentRow}`).value(parentItem.no)
      activeSheet
        .cell(`B${currentRow}`)
        .value(parentItem.parent_material_name || "")
      activeSheet
        .cell(`C${currentRow}`)
        .value(parentItem.dmm_unit_of_consumption_name || "")
      activeSheet
        .cell(`D${currentRow}`)
        .value(Number(parentItem.opening_qty) || 0) // STOK AWAL
      activeSheet
        .cell(`E${currentRow}`)
        .value(Number(parentItem.received_qty) || 0) // PENERIMAAN
      activeSheet
        .cell(`F${currentRow}`)
        .value(Number(parentItem.consumption_qty) || 0) // PEMAKAIAN
      activeSheet
        .cell(`G${currentRow}`)
        .value(Number(parentItem.closing_qty) || 0) // STOK AKHIR
      activeSheet.cell(`H${currentRow}`).value("") // PERIODE DISTRIBUSI
      activeSheet.cell(`I${currentRow}`).value("") // BESARAN PENYANGGA
      activeSheet.cell(`J${currentRow}`).value("") // WAKTU TUNGGU
      activeSheet
        .cell(`K${currentRow}`)
        .formula(
          `F${currentRow}+(I${currentRow}*F${currentRow})+(J${currentRow}*(F${currentRow}/H${currentRow}))`
        ) // STOK OPTIMUM
      activeSheet.cell(`L${currentRow}`).value("") // PERMINTAAN
      activeSheet.cell(`M${currentRow}`).value("") // PEMBERIAN

      // Budget sources for parent (aggregated from children)
      const parentBudgetSource = this.aggregateBudgetSources(
        parentItem.materials || []
      )
      activeSheet
        .cell(`N${currentRow}`)
        .value(parentBudgetSource.apbn ? this.t("lplpo.yes") : "")
      activeSheet
        .cell(`O${currentRow}`)
        .value(parentBudgetSource.dak ? this.t("lplpo.yes") : "")
      activeSheet
        .cell(`P${currentRow}`)
        .value(parentBudgetSource.apbd_1 ? this.t("lplpo.yes") : "")
      activeSheet
        .cell(`Q${currentRow}`)
        .value(parentBudgetSource.apbd_2 ? this.t("lplpo.yes") : "")
      activeSheet
        .cell(`R${currentRow}`)
        .value(parentBudgetSource.other ? this.t("lplpo.yes") : "")

      activeSheet.cell(`S${currentRow}`).value(parentItem.batches_code || "")
      activeSheet
        .cell(`T${currentRow}`)
        .value(
          parentItem.expired_date
            ? moment(parentItem.expired_date).format("YYYY-MM-DD")
            : ""
        )
      activeSheet.cell(`U${currentRow}`).value("") // KETERANGAN

      // Style parent row
      activeSheet.range(`A${currentRow}:U${currentRow}`).style({
        bold: true,
        border: true,
      })

      currentRow++

      // Add child material rows
      if (parentItem.materials && parentItem.materials.length > 0) {
        for (const material of parentItem.materials) {
          activeSheet.cell(`A${currentRow}`).value(material.no)
          activeSheet.cell(`B${currentRow}`).value(material.material_name || "")
          activeSheet
            .cell(`C${currentRow}`)
            .value(material.dmm_unit_of_consumption_name || "")
          activeSheet
            .cell(`D${currentRow}`)
            .value(Number(material.opening_qty) || 0) // STOK AWAL
          activeSheet
            .cell(`E${currentRow}`)
            .value(Number(material.received_qty) || 0) // PENERIMAAN
          activeSheet
            .cell(`F${currentRow}`)
            .value(Number(material.consumption_qty) || 0) // PEMAKAIAN
          activeSheet
            .cell(`G${currentRow}`)
            .value(Number(material.closing_qty) || 0) // STOK AKHIR
          activeSheet.cell(`H${currentRow}`).value("") // PERIODE DISTRIBUSI
          activeSheet.cell(`I${currentRow}`).value("") // BESARAN PENYANGGA
          activeSheet.cell(`J${currentRow}`).value("") // WAKTU TUNGGU
          activeSheet
            .cell(`K${currentRow}`)
            .formula(
              `F${currentRow}+(I${currentRow}*F${currentRow})+(J${currentRow}*(F${currentRow}/H${currentRow}))`
            ) // STOK OPTIMUM
          activeSheet.cell(`L${currentRow}`).value("") // PERMINTAAN
          activeSheet.cell(`M${currentRow}`).value("") // PEMBERIAN

          // Budget sources for child
          activeSheet
            .cell(`N${currentRow}`)
            .value(material.budget_source?.apbn ? this.t("lplpo.yes") : "")
          activeSheet
            .cell(`O${currentRow}`)
            .value(material.budget_source?.dak ? this.t("lplpo.yes") : "")
          activeSheet
            .cell(`P${currentRow}`)
            .value(material.budget_source?.apbd_1 ? this.t("lplpo.yes") : "")
          activeSheet
            .cell(`Q${currentRow}`)
            .value(material.budget_source?.apbd_2 ? this.t("lplpo.yes") : "")
          activeSheet
            .cell(`R${currentRow}`)
            .value(material.budget_source?.other ? this.t("lplpo.yes") : "")

          activeSheet.cell(`S${currentRow}`).value(material.batches_code || "")
          activeSheet
            .cell(`T${currentRow}`)
            .value(
              material.expired_date
                ? moment(material.expired_date).format("YYYY-MM-DD")
                : ""
            )
          activeSheet.cell(`U${currentRow}`).value("") // KETERANGAN

          // Style child row
          activeSheet.range(`A${currentRow}:U${currentRow}`).style({
            border: true,
          })

          currentRow++
        }
      }
    }

    return this
  }

  private aggregateBudgetSources(materials: any[]) {
    const aggregated = {
      apbn: false,
      dak: false,
      apbd_1: false,
      apbd_2: false,
      other: false,
    }

    for (const material of materials) {
      if (material.budget_source) {
        if (material.budget_source.apbn) aggregated.apbn = true
        if (material.budget_source.dak) aggregated.dak = true
        if (material.budget_source.apbd_1) aggregated.apbd_1 = true
        if (material.budget_source.apbd_2) aggregated.apbd_2 = true
        if (material.budget_source.other) aggregated.other = true
      }
    }

    return aggregated
  }

  async addProductTemplateRows(sheet: string, data: any[]) {
    // Access workbook directly from processor
    const workbook = (this.processor as any).workbook
    if (!workbook) {
      throw new Error("Workbook not initialized")
    }

    let activeSheet = workbook.sheet(sheet)
    if (!activeSheet) {
      throw new Error(`Sheet "${sheet}" not found in workbook`)
    }

    let currentRow = 12 // Start after header rows

    for (const parentItem of data) {
      // Add only parent material row, skip children
      activeSheet.cell(`A${currentRow}`).value(parentItem.no)
      activeSheet
        .cell(`B${currentRow}`)
        .value(parentItem.parent_material_name || "")
      activeSheet
        .cell(`C${currentRow}`)
        .value(parentItem.dmm_unit_of_consumption_name || "")
      activeSheet
        .cell(`D${currentRow}`)
        .value(Number(parentItem.opening_qty) || 0)
      activeSheet
        .cell(`E${currentRow}`)
        .value(Number(parentItem.received_qty) || 0)
      activeSheet
        .cell(`F${currentRow}`)
        .value(Number(parentItem.consumption_qty) || 0)
      activeSheet
        .cell(`G${currentRow}`)
        .value(Number(parentItem.closing_qty) || 0)
      activeSheet.cell(`H${currentRow}`).value("")
      activeSheet.cell(`I${currentRow}`).value("")
      activeSheet.cell(`J${currentRow}`).value("")
      activeSheet
        .cell(`K${currentRow}`)
        .formula(
          `F${currentRow}+(I${currentRow}*F${currentRow})+(J${currentRow}*(F${currentRow}/H${currentRow}))`
        )
      activeSheet.cell(`L${currentRow}`).value("")
      activeSheet.cell(`M${currentRow}`).value("")

      // Budget sources for parent (aggregated from children)
      const parentBudgetSource = this.aggregateBudgetSources(
        parentItem.materials || []
      )
      activeSheet
        .cell(`N${currentRow}`)
        .value(parentBudgetSource.apbn ? this.t("lplpo.yes") : "")
      activeSheet
        .cell(`O${currentRow}`)
        .value(parentBudgetSource.dak ? this.t("lplpo.yes") : "")
      activeSheet
        .cell(`P${currentRow}`)
        .value(parentBudgetSource.apbd_1 ? this.t("lplpo.yes") : "")
      activeSheet
        .cell(`Q${currentRow}`)
        .value(parentBudgetSource.apbd_2 ? this.t("lplpo.yes") : "")
      activeSheet
        .cell(`R${currentRow}`)
        .value(parentBudgetSource.other ? this.t("lplpo.yes") : "")

      activeSheet.cell(`S${currentRow}`).value(parentItem.batches_code || "")
      activeSheet
        .cell(`T${currentRow}`)
        .value(
          parentItem.expired_date
            ? moment(parentItem.expired_date).format("YYYY-MM-DD")
            : ""
        )
      activeSheet.cell(`U${currentRow}`).value("")

      // Style parent row - bold
      activeSheet.range(`A${currentRow}:U${currentRow}`).style({
        bold: true,
        border: true,
      })

      currentRow++
    }

    return this
  }
}
