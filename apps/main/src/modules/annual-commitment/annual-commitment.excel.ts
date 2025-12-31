import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import path from "path"

interface ContractMasterData {
  id: number
  contract_number: string
}
interface GeneralMasterData {
  id: number
  name: string | null
}
export class AnnualCommitmentTemplate extends BaseTemplate {
  constructor(
    startRow = 10,
    startSheet = 1,
    processor = PROCESSOR.XLSXPOPULATE
  ) {
    super(startRow, startSheet, processor)
  }

  async setContracts(rows: AsyncIterableIterator<ContractMasterData>) {
    return this.addRows(this.t("annual_commitment.sheet.contract_list"), rows)
  }

  async setVendors(rows: AsyncIterableIterator<GeneralMasterData>) {
    return this.addRows(this.t("annual_commitment.sheet.vendor_list"), rows)
  }

  async setMaterials(rows: AsyncIterableIterator<GeneralMasterData>) {
    return this.addRows(this.t("annual_commitment.sheet.material_list"), rows)
  }

  async loadFile(fileName: string) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "annual-commitment",
      fileName
    )
    await this.loadFromFile(templatePath)
  }
}
export class AnnualCommitmentExport extends BaseTemplate {
  constructor(startRow = 1, startSheet = 0, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }
}

export class AnnualCommitmentImport extends BaseTemplate {
  constructor(startRow = 10, startSheet = 1, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }
}
