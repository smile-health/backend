import ExcelJS from "exceljs";
import { SheetNotFound } from "../error-excel.js";
import {
  Column,
  IExcelProcessor,
  ReadRowsOptions,
  StyleOptions,
} from "./types.js";

export class ExcelJSProcessor implements IExcelProcessor {
  protected workbook: ExcelJS.Workbook;
  protected worksheet: ExcelJS.Worksheet | undefined;

  constructor(
    protected startRow: number = 14,
    protected startSheet = 0
  ) {
    this.workbook = new ExcelJS.Workbook();
  }

  private columnLetterToNumber(letter: string): number {
    let column = 0;
    for (let i = 0; i < letter.length; i++) {
      column +=
        (letter.charCodeAt(i) - 64) * Math.pow(26, letter.length - i - 1);
    }
    return column;
  }

  public async loadFromBuffer(buffer: ArrayBuffer): Promise<void> {
    await this.workbook.xlsx.load(buffer);
  }

  public async loadFromFile(path: string): Promise<void> {
    await this.workbook.xlsx.readFile(path);
  }

  public async initSheet(title: string): Promise<void> {
    this.worksheet = this.workbook.addWorksheet(title);
  }

  public async addRows(
    sheetName: string,
    rows: AsyncIterableIterator<object> | object[],
    rowIndex: number,
    columnLetter: string,
    style?: StyleOptions
  ): Promise<void> {
    const targetWorksheet = this.workbook.getWorksheet(sheetName);

    if (!targetWorksheet) {
      throw new SheetNotFound();
    }

    const columnNumber = this.columnLetterToNumber(columnLetter);

    for await (const row of rows) {
      const newRow = targetWorksheet.getRow(rowIndex);
      Object.values(row).forEach((value, index) => {
        newRow.getCell(columnNumber + index).value = value;
      });
      if (style?.border) {
        newRow.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      }
      rowIndex++;
    }
  }

  public getRows(sheetName?: string, options?: ReadRowsOptions): object[] {
    const targetWorksheet = sheetName
      ? this.workbook.getWorksheet(sheetName)
      : this.workbook.worksheets[this.startSheet];

    if (!targetWorksheet) {
      throw new SheetNotFound();
    }

    const rows: object[] = [];
    const headerRow = targetWorksheet.getRow(this.startRow - 1);
    const headers: string[] = [];
    headerRow.eachCell((cell) => {
      headers.push(cell.value?.toString() || "");
    });

    for (let i = this.startRow; i <= targetWorksheet.rowCount; i++) {
      const row = targetWorksheet.getRow(i);
      const rowData: { [key: string]: unknown } = {};
      let isEmptyRow = true;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          const rawValue = cell.value;
          const value =
            rawValue === null || rawValue === undefined
              ? options?.defval
                ? null
                : undefined
              : rawValue;
          rowData[header] = value;
          if (value !== null && value !== undefined && value !== "") {
            isEmptyRow = false;
          }
        }
      });
      if (options?.blankrows || !isEmptyRow) {
        rows.push(rowData);
      }
    }
    return rows;
  }

  public setColumns(
    columns: Column[],
    startCell: string,
    sheetName?: string
  ): void {
    const targetWorksheet = sheetName
      ? this.workbook.getWorksheet(sheetName)
      : this.worksheet;

    if (!targetWorksheet) {
      throw new SheetNotFound();
    }

    targetWorksheet.columns = columns.map((col) => ({
      key: col.key,
      header: col.header,
      width: col.width,
    }));
  }

  public async addDataValidation(
    sheetName: string,
    columnLetter: string,
    startRow: number,
    endRow: number,
    sourceSheetName: string,
    sourceColumnLetter: string,
    sourceStartRow: number,
    allowInvalid: boolean
  ): Promise<void> {
    const targetWorksheet = this.workbook.getWorksheet(sheetName);
    if (!targetWorksheet) {
      throw new SheetNotFound();
    }

    const sourceWorksheet = this.workbook.getWorksheet(sourceSheetName);
    if (!sourceWorksheet) {
      throw new SheetNotFound();
    }

    let lastRow = sourceStartRow;
    while (
      sourceWorksheet.getCell(`${sourceColumnLetter}${lastRow}`).value !== null
    ) {
      lastRow++;
    }
    lastRow--;

    if (lastRow < sourceStartRow) {
      return;
    }

    const quotedSourceSheetName = sourceSheetName.includes(" ")
      ? `'${sourceSheetName}'`
      : sourceSheetName;
    const dataValidationFormula = `${quotedSourceSheetName}!$${sourceColumnLetter}$${sourceStartRow}:$${sourceColumnLetter}$${lastRow}`;

    for (let row = startRow; row <= endRow; row++) {
      const cell = targetWorksheet.getCell(`${columnLetter}${row}`);
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [dataValidationFormula],
        showErrorMessage: !allowInvalid,
        errorStyle: "stop",
        errorTitle: "Invalid Entry",
        error: "Please select a value from the list.",
      };
    }
  }

  public async protectSheet(
    sheetName: string,
    password?: string
  ): Promise<void> {
    const targetWorksheet = this.workbook.getWorksheet(sheetName);
    if (!targetWorksheet) {
      throw new SheetNotFound();
    }
    await targetWorksheet.protect(password || "", {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: true,
      formatColumns: true,
      formatRows: true,
      insertColumns: true,
      insertRows: true,
      insertHyperlinks: true,
      deleteColumns: true,
      deleteRows: true,
      sort: true,
      autoFilter: true,
      pivotTables: true,
    });
  }

  public async setRowFontBold(
    sheetName: string,
    rowIndex: number,
    startColumnLetter: string = "A"
  ): Promise<void> {
    const targetWorksheet = this.workbook.getWorksheet(sheetName);
    if (!targetWorksheet) {
      throw new SheetNotFound();
    }
    const startCol = this.columnLetterToNumber(startColumnLetter);
    const row = targetWorksheet.getRow(rowIndex);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber >= startCol) {
        const existing = cell.font || {};
        cell.font = {
          ...existing,
          bold: true,
        } as Partial<ExcelJS.Font> as ExcelJS.Font;
      }
    });
  }

  public async setRowAlignCenter(
    sheetName: string,
    rowIndex: number,
    startColumnLetter: string = "A"
  ): Promise<void> {
    const targetWorksheet = this.workbook.getWorksheet(sheetName);
    if (!targetWorksheet) {
      throw new SheetNotFound();
    }

    const startCol = this.columnLetterToNumber(startColumnLetter);
    const row = targetWorksheet.getRow(rowIndex);
    const endCol = Math.max(startCol, row.cellCount);

    for (let colNumber = startCol; colNumber <= endCol; colNumber++) {
      const cell = row.getCell(colNumber);
      const existing = cell.alignment || {};
      cell.alignment = {
        ...(existing as Partial<ExcelJS.Alignment>),
        horizontal: "center",
        vertical: "middle",
      } as ExcelJS.Alignment;
    }
  }

  public mergeCells(
    sheetName: string,
    startCell: string,
    endCell: string,
    center?: boolean
  ): void {
    const targetWorksheet = this.workbook.getWorksheet(sheetName);
    if (!targetWorksheet) {
      throw new SheetNotFound();
    }
    targetWorksheet.mergeCells(`${startCell}:${endCell}`);

    if (center) {
      const cell = targetWorksheet.getCell(startCell);
      const existing = cell.alignment || {};
      cell.alignment = {
        ...(existing as Partial<ExcelJS.Alignment>),
        horizontal: "center",
        vertical: "middle",
      } as ExcelJS.Alignment;
    }
  }

  public async autoFitColumns(
    sheetName: string,
    rowIndex: number = 1,
    startColumnLetter: string = "A"
  ): Promise<void> {
    const targetWorksheet = this.workbook.getWorksheet(sheetName);
    if (!targetWorksheet) {
      throw new SheetNotFound();
    }
    const startCol = this.columnLetterToNumber(startColumnLetter);
    const headerRow = targetWorksheet.getRow(rowIndex);
    const lastCol = headerRow.cellCount;
    for (let col = startCol; col <= lastCol; col++) {
      const headerVal = headerRow.getCell(col).value;
      const len = (headerVal?.toString() || "").length;
      const width = Math.max(10, len + 2);
      const column = targetWorksheet.getColumn(col);
      column.width = width;
    }
  }

  public async generate(): Promise<ArrayBuffer> {
    return (await this.workbook.xlsx.writeBuffer()) as ArrayBuffer;
  }

  public async writeFile(filePath: string): Promise<void> {
    await this.workbook.xlsx.writeFile(filePath);
  }

  public async updateCellValue(
    sheetName: string,
    cellAddress: string,
    value: unknown
  ): Promise<void> {
    const targetWorksheet = this.workbook.getWorksheet(sheetName);

    if (!targetWorksheet) {
      throw new SheetNotFound();
    }

    const cell = targetWorksheet.getCell(cellAddress);
    cell.value = value as ExcelJS.CellValue;
  }

  public async setCellWrapText(
    sheetName: string,
    cellAddress: string
  ): Promise<void> {
    const targetWorksheet = this.workbook.getWorksheet(sheetName);

    if (!targetWorksheet) {
      throw new SheetNotFound();
    }

    const cell = targetWorksheet.getCell(cellAddress);
    cell.alignment = {
      wrapText: true,
      vertical: "top",
      horizontal: "left",
    };
  }

  public async updateMergedCellValue(
    sheetName: string,
    startCell: string,
    endCell: string,
    value: unknown
  ): Promise<void> {
    const targetWorksheet = this.workbook.getWorksheet(sheetName);

    if (!targetWorksheet) {
      throw new SheetNotFound();
    }

    // Merge cells
    targetWorksheet.mergeCells(`${startCell}:${endCell}`);

    // Set value
    const cell = targetWorksheet.getCell(startCell);
    cell.value = value as ExcelJS.CellValue;

    // Set styling
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    cell.font = {
      bold: true,
      size: 11,
    };
  }
}
