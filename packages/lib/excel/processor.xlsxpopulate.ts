import XlsxPopulate from "xlsx-populate";
import {
  SheetNotFound,
  WorkbookEmpty,
  WorkbookNotFound,
} from "../error-excel.js";
import {
  Column,
  IExcelProcessor,
  ReadRowsOptions,
  StyleOptions,
} from "./types.js";

export class XLSXPopulateProcessor implements IExcelProcessor {
  protected workbook: XlsxPopulate.Workbook | undefined;
  protected sheet: XlsxPopulate.Sheet | undefined;

  constructor(
    protected startRow: number = 14,
    protected startSheet = 1
  ) {}

  public async loadFromBuffer(buffer: ArrayBuffer) {
    this.workbook = await XlsxPopulate.fromDataAsync(buffer);
  }

  public async loadFromFile(path: string) {
    this.workbook = await XlsxPopulate.fromFileAsync(path);
  }

  async initSheet(title: string) {
    this.workbook = await XlsxPopulate.fromBlankAsync();
    this.sheet = this.workbook.sheet(0).name(title);
  }

  setColumns(columns: Column[], startCell = `A1`, sheetName?: string) {
    if (!this.workbook) {
      throw new WorkbookNotFound();
    }

    const sheet = sheetName
      ? this.workbook.sheet(sheetName)
      : this.workbook.sheets()[0];
    if (!sheet) {
      throw new SheetNotFound();
    }

    let colIndex = sheet.cell(startCell).columnNumber();
    const rowIndex = sheet.cell(startCell).rowNumber();

    for (const col of columns) {
      sheet.column(colIndex).width(col.width);
      sheet.row(rowIndex).cell(colIndex).value(col.header);
      colIndex++;
    }
  }

  public async addRows(
    sheetName: string,
    rows: AsyncIterableIterator<object> | object[],
    rowIndex = 2,
    columnLetter = "A",
    style?: StyleOptions
  ) {
    if (!this.workbook) {
      throw new WorkbookNotFound();
    }

    const sheet = this.workbook.sheet(sheetName);
    if (!sheet) {
      throw new SheetNotFound();
    }

    for await (const row of rows) {
      let colIndex = sheet.cell(`${columnLetter}${rowIndex}`).columnNumber();
      for (const key of Object.keys(row)) {
        sheet.row(rowIndex).cell(colIndex).value(row[key]);

        if (style) {
          sheet.row(rowIndex).cell(colIndex).style({
            border: style.border,
          });
        }

        colIndex++;
      }
      rowIndex++;
    }
  }

  public getRows(_sheetName?: string, _options?: ReadRowsOptions) {
    void [_sheetName, _options];

    if (!this.workbook) {
      throw new WorkbookNotFound();
    }

    const sheet = this.workbook.sheets()[this.startSheet];
    if (!sheet) {
      throw new SheetNotFound();
    }

    const data: object[] = [];
    const usedRange = sheet.usedRange(); // Get the used range of the sheet

    if (!usedRange) {
      throw new WorkbookEmpty();
    }

    const endRow = usedRange.endCell().rowNumber();
    const startCol = usedRange.startCell().columnNumber();
    const endCol = usedRange.endCell().columnNumber();

    // Get headers from the first row
    const headers: string[] = [];
    for (let col = startCol; col <= endCol; col++) {
      headers.push(String(sheet.cell(this.startRow - 1, col).value()));
    }

    // Loop through the remaining rows and convert to JSON
    for (let row = this.startRow; row <= endRow; row++) {
      const rowData = {};
      let isEmptyRow = true;

      for (let col = startCol; col <= endCol; col++) {
        const header = headers[col - startCol];
        const value = sheet.cell(row, col).value();

        // Only add non-null or non-undefined values to rowData
        if (value !== null && value !== undefined && value !== "") {
          rowData[header ?? ""] = value;
          isEmptyRow = false; // Mark row as not empty
        }
      }

      if (!isEmptyRow) {
        data.push(rowData); // Only push non-empty rows
      }
    }

    return data;
  }

  async generate(): Promise<ArrayBuffer> {
    if (!this.workbook) {
      throw new WorkbookNotFound();
    }

    return (await this.workbook.outputAsync("buffer")) as ArrayBuffer;
  }

  async writeFile(filePath: string) {
    if (!this.workbook) {
      throw new WorkbookNotFound();
    }

    return this.workbook.toFileAsync(filePath);
  }

  public async addDataValidation(
    _sheetName: string,
    _columnLetter: string,
    _startRow: number,
    _endRow: number,
    _sourceSheetName: string,
    _sourceColumnLetter: string,
    _sourceStartRow: number,
    _allowInvalid: boolean
  ): Promise<void> {
    void [
      _sheetName,
      _columnLetter,
      _startRow,
      _endRow,
      _sourceSheetName,
      _sourceColumnLetter,
      _sourceStartRow,
      _allowInvalid,
    ];
  }

  public async protectSheet(
    _sheetName: string,
    _password?: string
  ): Promise<void> {
    void [_sheetName, _password];
  }

  public async setRowFontBold(
    _sheetName: string,
    _rowIndex: number,
    _startColumnLetter?: string
  ): Promise<void> {
    void [_sheetName, _rowIndex, _startColumnLetter];
  }

  public async setRowAlignCenter(
    _sheetName: string,
    _rowIndex: number,
    _startColumnLetter?: string
  ): Promise<void> {
    void [_sheetName, _rowIndex, _startColumnLetter];
  }

  public mergeCells(
    _sheetName: string,
    _startCell: string,
    _endCell: string,
    _center?: boolean
  ): void {
    void [_sheetName, _startCell, _endCell, _center];
  }

  public async autoFitColumns(
    _sheetName: string,
    _rowIndex: number = 1,
    _startColumnLetter?: string
  ): Promise<void> {
    void [_sheetName, _rowIndex, _startColumnLetter];
  }

  public async updateCellValue(
    _sheetName: string,
    _cellAddress: string,
    _value: unknown
  ): Promise<void> {
    void [_sheetName, _cellAddress, _value];
  }

  public async setCellWrapText(
    _sheetName: string,
    _cellAddress: string
  ): Promise<void> {
    void [_sheetName, _cellAddress];
  }
}
