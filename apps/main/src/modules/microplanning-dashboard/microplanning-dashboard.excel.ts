import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"

export class MicroplanningDashboardExport extends BaseTemplate {
  constructor(startRow = 1, startSheet = 0, processor = PROCESSOR.EXCELJS) {
    super(startRow, startSheet, processor)
  }

  async setRowAlignment(
    sheetName: string,
    rowIndex: number,
    horizontal: "left" | "center" | "right" = "center",
    vertical: "top" | "middle" | "bottom" = "middle"
  ): Promise<void> {
    const processor = this.processor as any
    const workbook = processor.workbook
    const worksheet = workbook.getWorksheet(sheetName)
    if (!worksheet) return

    const row = worksheet.getRow(rowIndex)
    row.eachCell((cell: any) => {
      cell.alignment = {
        horizontal,
        vertical,
      }
    })
  }

  async setCellAlignment(
    sheetName: string,
    cellAddress: string,
    horizontal: "left" | "center" | "right" = "center",
    vertical: "top" | "middle" | "bottom" = "middle"
  ): Promise<void> {
    const processor = this.processor as any
    const workbook = processor.workbook
    const worksheet = workbook.getWorksheet(sheetName)
    if (!worksheet) return

    const cell = worksheet.getCell(cellAddress)
    cell.alignment = {
      horizontal,
      vertical,
    }
  }
}
