import momentTZ from "moment-timezone";
import XlsxPopulate from "xlsx-populate";
import { FileResponse } from "../types/file.js";
import { cleanSheetName } from "../utils.js";
import { Column, Filter } from "./types.js";

export default class WarehouseTemplate {
  protected workbook: XlsxPopulate.Workbook;
  protected lang: string = "en";
  protected timezone: string;
  protected title: string | undefined;
  protected columns: Record<string, Column[]>;
  protected currentRow: Record<string, number>;

  constructor() {
    this.timezone = "UTC";
    this.currentRow = {};
    this.columns = {};
  }

  public setLanguage(lang: string) {
    this.lang = lang;
  }

  public setTimezone(timezone?: string) {
    this.timezone = timezone ?? "UTC";
  }

  public setTitle(title: string) {
    this.title = title;
  }

  public async initWorkbook() {
    this.workbook = await XlsxPopulate.fromBlankAsync();
    return this;
  }

  public initSheet(sheetName: string) {
    const cleanedSheetName = cleanSheetName(sheetName);

    // XlsxPopulate init workbook will create a default sheet called 'Sheet1', so we need to consider that here
    let sheet: XlsxPopulate.Worksheet = this.workbook.sheet("Sheet1");
    if (!sheet) {
      // Reset current row only if there are no default sheet, this will prevent incorrect data rows placement
      sheet = this.workbook.addSheet(cleanedSheetName);
    } else {
      // If its our default sheet, just rename it, this is our first sheet
      this.workbook.sheet("Sheet1").name(cleanedSheetName);
    }

    this.currentRow[sheetName] = 1;
    return sheet;
  }

  public setTitleBar(sheetName: string, columns: Column[], title: string) {
    const cleanedSheetName = cleanSheetName(sheetName);
    const totalColumns = this.getTotalLeafColumns(columns);
    const startCell = this.workbook
      .sheet(cleanedSheetName)
      .cell(this.currentRow[sheetName], 1);
    const endCell = this.workbook
      .sheet(cleanedSheetName)
      .cell(this.currentRow[sheetName], totalColumns);

    this.workbook
      .sheet(cleanedSheetName)
      .range(startCell, endCell)
      .merged(true)
      .value(title)
      .style({
        horizontalAlignment: "center",
        verticalAlignment: "center",
        bold: true,
        fontFamily: "Calibri",
      });

    if (typeof this.currentRow[sheetName] === "undefined") {
      this.currentRow[sheetName] = 1;
    }
    this.currentRow[sheetName] += 2; // advanced to the next row section
  }

  public setFilters(sheetName: string, filters: Filter[], maxFilterRows = 3) {
    const cleanedSheetName = cleanSheetName(sheetName);
    const filterColumnGap = 1; // 1 column gap between filter blocks

    let currentFilterRow = this.currentRow[sheetName];
    let currentFilterCol = 1;

    filters.forEach((filter, index) => {
      const keyCell = this.workbook
        .sheet(cleanedSheetName)
        .cell(currentFilterRow, currentFilterCol);
      const valueCell = this.workbook
        .sheet(cleanedSheetName)
        .cell(currentFilterRow, currentFilterCol + 1);

      keyCell
        .value(`${filter.key}:`)
        .style({ bold: true, fontFamily: "Calibri" });
      valueCell.value(filter.value);

      if ((index + 1) % maxFilterRows === 0) {
        currentFilterCol += 2 + filterColumnGap; // Move to next block of columns
        currentFilterRow = this.currentRow[sheetName]; // Reset row for new block
      } else {
        currentFilterRow++; // Move to next row within the current block
      }
    });

    this.currentRow[sheetName] += maxFilterRows + 1; // advanced to the next row section
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public setColumns(columns: Column[], startCell = "A1", sheetName: string) {
    const cleanedSheetName = cleanSheetName(sheetName);
    const columnStartRow = this.currentRow[sheetName];
    const columnEndRow =
      this.currentRow[sheetName] + this.getMaxColumnDepth(columns) - 1;

    this.renderColumns(
      this.workbook.sheet(cleanedSheetName),
      columns,
      columnStartRow,
      1
    );

    // Set column widths
    this.setColumnWidths(this.workbook.sheet(cleanedSheetName), columns);

    this.columns[sheetName] = columns;

    this.currentRow[sheetName] = columnEndRow + 1; // advanced to the next row section
  }

  public addRows(
    sheetName: string,
    rows: AsyncIterableIterator<object> | object[]
  ) {
    const cleanedSheetName = cleanSheetName(sheetName);
    const flatColumns = this.flattenColumns(this.columns[sheetName] ?? []); // ensure we are iterating through the leaf columns

    for (const [rowIndex, row] of Object.entries(rows)) {
      flatColumns.forEach((column, columnIndex) => {
        const columnKey = column.key!;
        this.workbook
          .sheet(cleanedSheetName)
          .cell(this.currentRow[sheetName] + Number(rowIndex), columnIndex + 1)
          .value(row[columnKey]);
      });
    }
  }

  async generate(file?: string): Promise<FileResponse> {
    const currentTime = momentTZ().tz(this.timezone);
    const formatDate =
      currentTime.format("MM-DD-YYYY HH_mm_ss") +
      " GMT" +
      currentTime.format("Z").replace(":00", "");

    let filename = `${this.title} ${formatDate}_${this.lang}`;
    if (file) {
      filename = file;
    }

    return {
      filename,
      buffer: await this.workbook.outputAsync("buffer"),
    };
  }

  private getMaxColumnDepth(columns: Column[]): number {
    let maxDepth = 1;
    for (const column of columns) {
      if (column.children && column.children.length > 0) {
        maxDepth = Math.max(
          maxDepth,
          1 + this.getMaxColumnDepth(column.children)
        );
      }
    }
    return maxDepth;
  }

  private getTotalLeafColumns(columns: Column[]): number {
    let count = 0;
    for (const column of columns) {
      if (column.children && column.children.length > 0) {
        count += this.getTotalLeafColumns(column.children);
      } else {
        count++;
      }
    }
    return count;
  }

  private flattenColumns(columns: Column[]): Column[] {
    const result: Column[] = [];

    const traverse = (columns: Column[]) => {
      for (const column of columns) {
        if (column.children && column.children.length > 0) {
          traverse(column.children);
        } else {
          result.push(column);
        }
      }
    };

    traverse(columns);
    return result;
  }

  private renderColumns(
    sheet: XlsxPopulate.Worksheet,
    columns: Column[],
    startRow: number,
    startCol: number,
    currentDepth: number = 1
  ) {
    const maxDepth = this.getMaxColumnDepth(columns);
    let currentCol = startCol;

    for (const column of columns) {
      const leafColumns = this.getTotalLeafColumns([column]);
      const endCol = currentCol + leafColumns - 1;

      if (column.children && column.children.length > 0) {
        // Parent column
        const endRow = startRow + currentDepth - 1;
        sheet
          .range(startRow, currentCol, endRow, endCol)
          .merged(true)
          .value(column.header)
          .style({
            horizontalAlignment: "center",
            verticalAlignment: "center",
            bold: true,
            border: true,
            fontFamily: "Calibri",
            ...(column.color && { fill: column.color }),
          });
        this.renderColumns(
          sheet,
          column.children,
          startRow + currentDepth,
          currentCol,
          currentDepth
        );
      } else {
        // Leaf column
        const endRow = startRow + maxDepth - currentDepth;
        sheet
          .range(startRow, currentCol, endRow, endCol)
          .merged(true)
          .value(column.header)
          .style({
            horizontalAlignment: "center",
            verticalAlignment: "center",
            bold: true,
            border: true,
            fontFamily: "Calibri",
            ...(column.color && { fill: column.color }),
          });
      }
      currentCol = endCol + 1;
    }
  }

  private setColumnWidths(sheet: XlsxPopulate.Worksheet, columns: Column[]) {
    let currentCol = 1;
    const setWidth = (h: Column[]) => {
      for (const column of h) {
        if (column.children && column.children.length > 0) {
          setWidth(column.children);
        } else {
          sheet.column(currentCol).width(column.width);
          currentCol++;
        }
      }
    };
    setWidth(columns);
  }
}
