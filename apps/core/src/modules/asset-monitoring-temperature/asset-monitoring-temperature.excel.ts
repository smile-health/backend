import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"

export interface TemperatureHistoryExportData {
  no: number
  nama_logger: string
  suhu: number
  status_cold_chain_equipment: string
  tanggal_tercatat: string
}

export class AssetMonitoringTemperatureExport extends BaseTemplate {
  constructor(
    startRow = 1,
    startSheet = 0,
    processor = PROCESSOR.XLSXPOPULATE
  ) {
    super(startRow, startSheet, processor)
  }
}
