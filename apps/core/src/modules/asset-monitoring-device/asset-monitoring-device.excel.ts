import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import path from "path"

interface MasterDataContactPerson {
  id: number
  name: string | null
  phone: string | null
}

export class AssetMonitoringDeviceTemplate extends BaseTemplate {
  constructor(
    startRow = 10,
    startSheet = 1,
    processor = PROCESSOR.XLSXPOPULATE
  ) {
    super(startRow, startSheet, processor)
  }

  async setContactPersons(rows: AsyncIterableIterator<MasterDataContactPerson>) {
    return this.addRows(this.t("asset_monitoring_device.sheet.contact_person_list"), rows)
  }

  async loadFile(fileName: string) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "asset-monitoring-device",
      fileName
    )
    await this.loadFromFile(templatePath)
  }
}

export class AssetMonitoringDeviceExport extends BaseTemplate {
  constructor(startRow = 1, startSheet = 0, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }
}

export class AssetMonitoringDeviceImport extends BaseTemplate {
  constructor(startRow = 10, startSheet = 1, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }
}