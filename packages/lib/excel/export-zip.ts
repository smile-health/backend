import { createReadStream, createWriteStream, unlinkSync } from "fs";
import JSZip from "jszip";
import { Client } from "minio";
import BaseTemplate from "./index.js";
import { PROCESSOR } from "./types.js";

export interface ExcelZipExportOptions {
  title: string;
  language: string;
  timezone?: string;
  batchSize?: number;
  bucketName?: string;
}

export class ExcelZipExporter {
  private zip: JSZip;
  private batchSize: number;
  private fileIndex: number;
  private rows: Record<string, unknown>[];
  private excelTemplate: BaseTemplate;
  private bucketName: string;

  constructor(private options: ExcelZipExportOptions) {
    this.zip = new JSZip();
    this.batchSize = options.batchSize || 100000;
    this.fileIndex = 1;
    this.rows = [];
    this.bucketName = options.bucketName || "smile-platform";
    this.excelTemplate = this.createExcelTemplate();
  }

  private createExcelTemplate(): BaseTemplate {
    const excelTemplate = new BaseTemplate(PROCESSOR.SHEETJS);
    excelTemplate.setTitle(this.options.title);
    excelTemplate.setLanguage(this.options.language);
    if (this.options.timezone) {
      excelTemplate.setTimezone(this.options.timezone);
    }
    excelTemplate.initSheet(this.options.title);
    return excelTemplate;
  }

  public setColumns(columns: { header: string; width: number }[]) {
    this.excelTemplate.setColumns(columns);
    return this;
  }

  public addRow(row: Record<string, unknown>) {
    this.rows.push(row);

    if (this.rows.length === this.batchSize) {
      this.flushRows();
    }

    return this;
  }

  public async addRows(rows: Record<string, unknown>[]): Promise<this> {
    for (const row of rows) {
      this.addRow(row);
    }
    return this;
  }

  private async flushRows() {
    if (this.rows.length === 0) return;

    await this.excelTemplate.addRows(this.options.title, this.rows);
    const { buffer } = await this.excelTemplate.generate();
    this.zip.file(
      `${this.options.title}_part${this.fileIndex}.xlsx`,
      Buffer.from(buffer as ArrayBuffer)
    );

    this.fileIndex++;
    this.rows = [];
    this.excelTemplate = this.createExcelTemplate();
  }

  public async finalize() {
    await this.flushRows();
    return this.zip;
  }

  public async exportToMinio(
    minioClient: Client,
    endpointUrl: string,
    originalFilename: string
  ): Promise<string> {
    try {
      const zipStream = (await this.finalize()).generateNodeStream({
        type: "nodebuffer",
        streamFiles: true,
      });
      const zipFilePath = originalFilename;
      const output = createWriteStream(zipFilePath);
      zipStream.pipe(output);
      await new Promise<void>((resolve) =>
        output.on("finish", () => resolve())
      );

      if (!(await minioClient.bucketExists(this.bucketName))) {
        await minioClient.makeBucket(
          this.bucketName,
          process.env.MINIO_REGION ?? "ap-southeast-3"
        );
      }

      await minioClient.putObject(
        this.bucketName,
        zipFilePath,
        createReadStream(zipFilePath)
      );

      unlinkSync(zipFilePath);

      return `${endpointUrl}/${this.bucketName}/${zipFilePath}`;
    } catch (error) {
      console.error("❌ Error uploading file to Minio:", error);
      throw error;
    }
  }
}
