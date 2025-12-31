import * as XLSX from "@e965/xlsx";
import fs from "fs";
import { SheetNotFound, WorkbookNotFound } from "../error-excel.js";
import { collect } from "../utils.js";
import { Column, IExcelProcessor, ReadRowsOptions } from "./types.js";
XLSX.set_fs(fs);

export class SheetJSProcessor implements IExcelProcessor {
  protected workbook: XLSX.WorkBook | undefined;
  protected sheet: XLSX.WorkSheet | undefined;

  constructor(
    protected startRow: number = 14,
    protected startSheet = 1
  ) {
    this.workbook = XLSX.utils.book_new();
  }

  public async loadFromBuffer(buffer: Buffer) {
    this.workbook = XLSX.read(buffer, { type: "buffer" });
  }

  public async loadFromFile(path: string) {
    const fileBuffer = fs.readFileSync(path);
    this.workbook = XLSX.read(fileBuffer, { type: "buffer" });
  }

  public async initSheet(title: string) {
    if (!this.workbook) {
      throw new WorkbookNotFound();
    }

    const sheet = XLSX.utils.sheet_new();
    XLSX.utils.book_append_sheet(this.workbook, sheet, title);
  }

  public getStartRow() {
    return this.startRow;
  }

  setColumns(columns: Column[], startCell = "A1", sheetName?: string) {
    if (!this.workbook) {
      throw new WorkbookNotFound();
    }

    const sheet =
      this.workbook.Sheets[sheetName ?? this.workbook.SheetNames[0] ?? 0];
    if (!sheet) {
      throw new SheetNotFound();
    }
    sheet["!cols"] = columns.map((col) => ({ wch: col.width }));

    XLSX.utils.sheet_add_aoa(sheet, [collect(columns, "header")], {
      origin: startCell,
    });

    this.workbook.Sheets[sheetName ?? this.workbook.SheetNames[0] ?? 0] = sheet;
  }

  public async addRows(
    sheetName: string,
    rows: AsyncIterableIterator<object> | object[],
    rowIndex = 2,
    columnLetter = "A"
  ) {
    if (!this.workbook) {
      throw new WorkbookNotFound();
    }

    const sheet = this.workbook.Sheets[sheetName];
    if (!sheet) {
      throw new SheetNotFound();
    }

    for await (const row of rows) {
      XLSX.utils.sheet_add_aoa(sheet, [Object.values(row)], {
        origin: `${columnLetter}${rowIndex}`,
      });
      rowIndex++;
    }

    this.workbook.Sheets[sheetName] = sheet;
  }

  public getRows(sheetName?: string, options?: ReadRowsOptions) {
    if (!this.workbook) {
      throw new WorkbookNotFound();
    }

    const sheet =
      this.workbook.Sheets[
        sheetName ?? this.workbook.SheetNames[this.startSheet] ?? "DATA ENTRY"
      ];
    if (!sheet) {
      throw new SheetNotFound();
    }

    const jsonOptions: XLSX.Sheet2JSONOpts = {
      range: this.startRow - 2,
    };

    if (options?.blankrows) {
      jsonOptions.blankrows = true;
    }

    if (options?.defval) {
      jsonOptions.defval = null;
    }

    const data = XLSX.utils.sheet_to_json(sheet, jsonOptions);

    return data as object[];
  }

  async generate(): Promise<ArrayBuffer> {
    if (!this.workbook) {
      throw new WorkbookNotFound();
    }

    return await XLSX.write(this.workbook, {
      bookType: "xlsx",
      type: "buffer",
    });
  }

  async writeFile(filePath: string) {
    if (!this.workbook) {
      throw new WorkbookNotFound();
    }

    XLSX.writeFile(this.workbook, filePath);
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
