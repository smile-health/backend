import { Column, Filter } from "@smile/lib/excel/types.js"

export type ExcelExportOption = {
  sheetName: string
  titleBar: string
  filters: Filter[]
  columns: Column[]
  data: AsyncIterableIterator<object> | object[]
}
