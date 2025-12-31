import { TFunction } from "i18next";
import momentTZ from "moment-timezone";
import i18n from "../i18n.js";
import { FileResponse } from "../types/file.js";
import { MasterData } from "../types/param.js";
import { ExcelJSProcessor } from "./processor.exceljs.js";
import { SheetJSProcessor } from "./processor.sheetjs.js";
import { XLSXPopulateProcessor } from "./processor.xlsxpopulate.js";
import {
  Column,
  IExcelProcessor,
  PROCESSOR,
  ReadRowsOptions,
  StyleOptions,
} from "./types.js";

export default class BaseTemplate {
  protected processor: IExcelProcessor;
  protected title: string | undefined;
  protected timezone: string;
  protected lang: string = "en";
  protected t: TFunction;
  constructor(
    protected startRow: number = 14,
    protected startSheet = 1,
    processor = PROCESSOR.SHEETJS
  ) {
    if (processor === PROCESSOR.XLSXPOPULATE) {
      this.processor = new XLSXPopulateProcessor(startRow, startSheet);
    } else if (processor === PROCESSOR.EXCELJS) {
      this.processor = new ExcelJSProcessor(startRow, startSheet);
    } else {
      this.processor = new SheetJSProcessor(startRow, startSheet);
    }
    this.timezone = "UTC";
    this.t = i18n.cloneInstance().t;
  }

  private getSuffix = (filename: string) => {
    const match = filename.match(/_([a-zA-Z0-9]+)\.[a-z0-9]+$/i);
    return match ? match[1] : null;
  };

  public setLanguage(lang: string) {
    this.lang = lang;
    const tranlator = i18n.cloneInstance();
    tranlator.changeLanguage(this.lang);

    this.t = tranlator.t;
  }

  public setLanguageByFileName(fileName: string) {
    const lang = this.getSuffix(fileName) || "en";
    this.setLanguage(lang);
  }

  setTitle(title: string) {
    this.title = title;
  }

  setTimezone(timezone?: string) {
    this.timezone = timezone ?? "UTC";
  }

  public async populateMasterData(
    sheetName: string,
    rows: AsyncIterableIterator<MasterData>
  ) {
    return this.addRows(sheetName, rows);
  }

  public async loadFromBuffer(buffer: ArrayBuffer | Buffer) {
    return await this.processor.loadFromBuffer(buffer);
  }

  public async loadFromFile(path: string) {
    this.setLanguageByFileName(path);
    return await this.processor.loadFromFile(path);
  }

  public async initSheet(title: string) {
    return await this.processor.initSheet(title);
  }

  public async addRows(
    sheetName: string,
    rows: AsyncIterableIterator<object> | object[],
    rowIndex = 2,
    columnLetter = "A",
    style?: StyleOptions
  ) {
    return await this.processor.addRows(
      sheetName,
      rows,
      rowIndex,
      columnLetter,
      style
    );
  }

  public getRows(sheetName?: string, options?: ReadRowsOptions) {
    return this.processor.getRows(sheetName, options);
  }

  public getStartRow() {
    return this.startRow;
  }

  public setColumns(columns: Column[], startCell = "A1", sheetName?: string) {
    return this.processor.setColumns(columns, startCell, sheetName);
  }

  public async addDataValidation(
    sheetName: string,
    columnLetter: string,
    startRow: number,
    endRow: number,
    sourceSheetName: string,
    sourceColumnLetter: string,
    sourceStartRow: number = 2,
    allowInvalid: boolean = false
  ) {
    return await this.processor.addDataValidation(
      sheetName,
      columnLetter,
      startRow,
      endRow,
      sourceSheetName,
      sourceColumnLetter,
      sourceStartRow,
      allowInvalid
    );
  }

  async protectSheet(sheetName: string, password?: string) {
    return this.processor.protectSheet(sheetName, password);
  }

  async setRowFontBold(
    sheetName: string,
    rowIndex: number,
    startColumnLetter?: string
  ) {
    return this.processor.setRowFontBold(
      sheetName,
      rowIndex,
      startColumnLetter
    );
  }

  async setRowAlignCenter(
    sheetName: string,
    rowIndex: number,
    startColumnLetter?: string
  ) {
    return this.processor.setRowAlignCenter(
      sheetName,
      rowIndex,
      startColumnLetter
    );
  }

  mergeCells(
    sheetName: string,
    startCell: string,
    endCell: string,
    center?: boolean
  ) {
    return this.processor.mergeCells(sheetName, startCell, endCell, center);
  }

  async autoFitColumns(
    sheetName: string,
    rowIndex: number = 1,
    startColumnLetter?: string
  ) {
    return this.processor.autoFitColumns(
      sheetName,
      rowIndex,
      startColumnLetter
    );
  }

  async generate(file?: string): Promise<FileResponse> {
    const currentTime = momentTZ().tz(this.timezone);
    const formatDate =
      currentTime.format("DD-MMM-YYYY HH_mm_ss").toUpperCase() +
      " GMT" +
      currentTime.format("Z").replace(":00", "");

    let filename = `${this.title} ${formatDate}_${this.lang}`;
    if (file) {
      filename = file;
    }

    return {
      filename,
      buffer: await this.processor.generate(),
    };
  }

  async writeFile(filePath: string) {
    return this.processor.writeFile(filePath);
  }

  public async updateCellValue(
    sheetName: string,
    cellAddress: string,
    value: unknown
  ): Promise<void> {
    return await this.processor.updateCellValue(sheetName, cellAddress, value);
  }

  public async setCellWrapText(
    sheetName: string,
    cellAddress: string
  ): Promise<void> {
    return await this.processor.setCellWrapText(sheetName, cellAddress);
  }

  public async updateMergedCellValue(
    sheetName: string,
    startCell: string,
    endCell: string,
    value: unknown
  ): Promise<void> {
    const processor = this.processor as unknown as {
      updateMergedCellValue?: (
        sheetName: string,
        startCell: string,
        endCell: string,
        value: unknown
      ) => Promise<void>;
    };

    if (typeof processor.updateMergedCellValue === "function") {
      return await processor.updateMergedCellValue(
        sheetName,
        startCell,
        endCell,
        value
      );
    }
    // Fallback: hanya update cell pertama
    return await this.processor.updateCellValue(sheetName, startCell, value);
  }
}
