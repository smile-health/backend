export interface Column {
  key?: string;
  header: string;
  width: number;
  color?: string;
  children?: Column[];
}

export interface Filter {
  key: string;
  value: string;
}

export interface StyleOptions {
  border?: boolean;
}

export interface ReadRowsOptions {
  blankrows?: boolean;
  defval?: boolean;
}

export const PROCESSOR = {
  SHEETJS: 1,
  XLSXPOPULATE: 2,
  EXCELJS: 3,
};

export interface IExcelProcessor {
  loadFromBuffer(buffer: ArrayBuffer | Buffer): Promise<void>;
  loadFromFile(path: string): Promise<void>;
  initSheet(title: string): Promise<void>;
  addRows(
    sheetName: string,
    rows: AsyncIterableIterator<object> | object[],
    rowIndex: number,
    columnLetter: string,
    style?: StyleOptions
  ): Promise<void>;
  getRows(sheetName?: string, options?: ReadRowsOptions): object[];
  setColumns(columns: Column[], startCell: string, sheetName?: string): void;
  addDataValidation(
    sheetName: string,
    columnLetter: string,
    startRow: number,
    endRow: number,
    sourceSheetName: string,
    sourceColumnLetter: string,
    sourceStartRow: number,
    allowInvalid: boolean
  ): Promise<void>;
  protectSheet(sheetName: string, password?: string): Promise<void>;
  setRowFontBold(
    sheetName: string,
    rowIndex: number,
    startColumnLetter?: string
  ): Promise<void>;
  setRowAlignCenter(
    sheetName: string,
    rowIndex: number,
    startColumnLetter?: string
  ): Promise<void>;
  mergeCells(
    sheetName: string,
    startCell: string,
    endCell: string,
    center?: boolean
  ): void;
  autoFitColumns(
    sheetName: string,
    rowIndex?: number,
    startColumnLetter?: string
  ): Promise<void>;
  generate(): Promise<ArrayBuffer>;
  writeFile(filePath: string): Promise<void>;
  updateCellValue(
    sheetName: string,
    cellAddress: string,
    value: unknown
  ): Promise<void>;
  setCellWrapText(sheetName: string, cellAddress: string): Promise<void>;
}
