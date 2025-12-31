/* eslint-disable @typescript-eslint/no-explicit-any */
import Excel, { Column, Workbook, Worksheet } from "exceljs";
import { FileResponse } from "./types/file.js";

export class ExportTemplate {
  private workbook: Workbook;
  private worksheet: Worksheet;

  constructor(private model: string) {
    this.workbook = this.initWorkbook();
    this.worksheet = this.initWorksheet();
  }

  initWorkbook() {
    const workbook = new Excel.Workbook();
    workbook.creator = "SMILE";
    workbook.views = [
      {
        x: 0,
        y: 0,
        width: 10000,
        height: 20000,
        firstSheet: 0,
        activeTab: 1,
        visibility: "visible",
      },
    ];

    return workbook;
  }

  initWorksheet(model = this.model) {
    return this.workbook.addWorksheet(model, {
      headerFooter: { firstHeader: model, firstFooter: model },
    });
  }

  setColumns(columns: Partial<Column>[]) {
    this.worksheet.columns = columns;
  }

  addRow(values: any) {
    this.worksheet.addRow(values);
  }

  async generate(filename: string): Promise<FileResponse> {
    const buffer = await this.workbook.xlsx.writeBuffer();
    return {
      filename,
      buffer: buffer,
    };
  }

  setCell(dataObject) {
    const { cell, value, width, bold } = dataObject;
    this.worksheet.getCell(cell).value = value;
    const column = this.worksheet.getCell(cell).col;
    if (width) {
      this.worksheet.getColumn(column).width = width;
    }

    if (bold) {
      this.worksheet.getCell(cell).font = { bold };
    }
  }

  mergeCells(cell1, cell2) {
    this.worksheet.mergeCells(cell1, cell2);
  }

  createTable(dataObject) {
    const { theme, tableName, startCell, columns, rows } = dataObject;
    const startCol = this.worksheet.getCell(startCell).col;
    this.worksheet.addTable({
      name: tableName,
      ref: startCell,
      style: {
        theme: theme || "TableStyleLight1",
      },
      columns: columns.map((col, i) => {
        this.worksheet.getColumn(startCol + i).width = col.width; // Set column widths dynamically
        return { name: col.header };
      }),
      rows: rows,
    });
  }

  async loadFile(pathname: string) {
    await this.workbook.xlsx.readFile(pathname);
  }

  addWorksheet(model: string) {
    this.worksheet = this.initWorksheet(model);
  }

  setCustomCells(dataObject) {
    const { startCell, totalRowData, totalColumnData, options } = dataObject;
    const { border, fill, alignment, font, style } = options;
    const startRow = this.worksheet.getCell(startCell).row;
    const startCol = this.worksheet.getCell(startCell).col;

    for (
      let colIndex = Number(startCol);
      colIndex < Number(startCol) + totalColumnData;
      colIndex++
    ) {
      for (
        let rowIndex = Number(startRow);
        rowIndex < Number(startRow) + totalRowData;
        rowIndex++
      ) {
        const cell = this.worksheet.getCell(rowIndex, colIndex);
        if (border) {
          cell.border = border;
        }

        if (fill) {
          cell.fill = fill;
        }

        if (alignment) {
          cell.alignment = alignment;
        }

        if (font) {
          cell.font = font;
        }

        if (style) {
          cell.style = style;
        }
      }
    }
  }
}

export class ImportTemplate {
  protected workbook: Workbook;
  protected worksheet: Worksheet | undefined;

  constructor(
    protected columnSize: number,
    protected startRow: number = 14,
    protected startSheet = 1
  ) {
    this.workbook = this.initWorkbook();
  }

  initWorkbook() {
    const workbook = new Excel.Workbook();
    return workbook;
  }

  public async loadFromBuffer(buffer: ArrayBuffer) {
    await this.workbook.xlsx.load(buffer);
    this.worksheet = this.workbook.worksheets[this.startSheet];
  }

  public getStartRow() {
    return this.startRow;
  }

  public getColumnSize() {
    return this.columnSize;
  }

  public getColumns(): string[] {
    const columns: string[] = [];

    if (!this.worksheet) {
      return columns;
    }

    const row = this.worksheet.getRow(this.startRow - 1);
    for (let i = 0; i < this.columnSize; i++) {
      columns.push(row.getCell(i + 1).text.trim());
    }

    return columns;
  }

  public getRows(): string[][] {
    const rows: string[][] = [];
    if (!this.worksheet) {
      return [];
    }

    this.worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rowData: string[] = [];
      if (rowNumber >= this.startRow) {
        for (let i = 0; i < this.columnSize; i++) {
          rowData.push(row.getCell(i + 1).text.trim());
        }
        rows.push(rowData);
      }
    });

    return rows;
  }
}
