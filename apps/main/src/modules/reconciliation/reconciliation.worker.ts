import { DB } from "@/common/infrastructure/database/types/db.js"
import env from "@/config/env.js"
import i18n from "@smile-health/lib/i18n.js"
import { logger } from "@smile-health/lib/logger.js"
import { createMinioClientFromEnv } from "@smile-health/lib/minio.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { formatDateWithTimezone } from "@smile-health/lib/utils.js"
import { createReadStream, createWriteStream, unlinkSync } from "fs"
import JSZip from "jszip"
import moment from "moment"
import { BaseWorker } from "../base.worker.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { ReconciliationTemplate } from "./reconciliation.excel.js"
import { ReconciliationRepository } from "./reconciliation.repository.js"
import { GetListReconciliationQueries } from "./reconciliation.schema.js"

export class ReconciliationWorker extends BaseWorker {
  constructor(
    private readonly repo: ReconciliationRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository
  ) {
    super(exportHistoryRepo)
  }

  public registerWorkers(consumer: Consumer<DB>) {
    consumer.route(TOPIC.RECONCILIATION_EXPORTED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      const { params, options, language, timezone, programId } =
        parseMsg.payload

      await this.processExport(
        c,
        options,
        params,
        language,
        timezone,
        programId
      )
    })
  }

  private async processExport(
    c: CustomContext<DB>,
    options: { export_id: number; original_filename: string; filename: string },
    params: GetListReconciliationQueries,
    language: string,
    timezone: string,
    programId: number
  ) {
    if (!this.exportHistoryRepo) {
      throw new Error("export history repo not yet initialized")
    }

    // set language
    const translator = i18n.cloneInstance()
    translator.changeLanguage(language)
    Object.assign(c.var, { t: translator.t })

    try {
      await this.exportHistoryRepo.upsert(
        c,
        {
          status: "in_progress",
        },
        options.export_id
      )

      const stream = await this.repo.getListReconciliationStream(
        c,
        params,
        programId
      )

      const excelTemplate = new ReconciliationTemplate()
      await excelTemplate.loadFile(language)
      excelTemplate.setTitle(c.var.t("reconciliation.label.title"))
      excelTemplate.setTimezone(timezone)

      let index = 0
      const rows: (string | number | Date | null)[][] = []
      for await (const item of stream) {
        const title =
          item.reason_title && item.action_title
            ? c.var.t(`reconciliation.label.reason.${item.reason_title}`) +
              "-" +
              c.var.t(`reconciliation.label.action.${item.action_title}`)
            : ""

        if (rows[index]?.[0] === item.reconciliation_id) {
          if (item.reconciliation_category_id === 1) {
            rows[index]![6] =
              item.recorded_qty !== 0
                ? Number(item.recorded_qty)
                : Number(rows[index]![6]) + Number(item.recorded_qty)
            rows[index]![7] =
              item.actual_qty !== 0
                ? Number(item.actual_qty)
                : Number(rows[index]![7]) + Number(item.actual_qty)
            rows[index]![8] = rows[index]![8]
              ? String(rows[index]![8]).includes(";")
                ? `${String(rows[index]![8])}` + ";" + `(${title})`
                : `(${String(rows[index]![8])})` + ";" + `(${title})`
              : title
          }

          if (item.reconciliation_category_id === 2) {
            rows[index]![9] =
              item.recorded_qty !== 0
                ? Number(item.recorded_qty)
                : Number(rows[index]![9]) + Number(item.recorded_qty)
            rows[index]![10] =
              item.actual_qty !== 0
                ? Number(item.actual_qty)
                : Number(rows[index]![10]) + Number(item.actual_qty)
            rows[index]![11] = rows[index]![11]
              ? String(rows[index]![11]).includes(";")
                ? `${String(rows[index]![11])}` + ";" + `(${title})`
                : `(${String(rows[index]![11])})` + ";" + `(${title})`
              : title
          }

          if (item.reconciliation_category_id === 3) {
            rows[index]![12] =
              item.recorded_qty !== 0
                ? Number(item.recorded_qty)
                : Number(rows[index]![12]) + Number(item.recorded_qty)
            rows[index]![13] =
              item.actual_qty !== 0
                ? Number(item.actual_qty)
                : Number(rows[index]![13]) + Number(item.actual_qty)
            rows[index]![14] = rows[index]![14]
              ? String(rows[index]![14]).includes(";")
                ? `${String(rows[index]![14])}` + ";" + `(${title})`
                : `(${String(rows[index]![14])})` + ";" + `(${title})`
              : title
          }

          if (item.reconciliation_category_id === 4) {
            rows[index]![15] =
              item.recorded_qty !== 0
                ? Number(item.recorded_qty)
                : Number(rows[index]![15]) + Number(item.recorded_qty)
            rows[index]![16] =
              item.actual_qty !== 0
                ? Number(item.actual_qty)
                : Number(rows[index]![16]) + Number(item.actual_qty)
            rows[index]![17] = rows[index]![17]
              ? String(rows[index]![17]).includes(";")
                ? `${String(rows[index]![17])}` + ";" + `(${title})`
                : `(${String(rows[index]![17])})` + ";" + `(${title})`
              : title
          }

          if (item.reconciliation_category_id === 5) {
            rows[index]![18] =
              item.recorded_qty !== 0
                ? Number(item.recorded_qty)
                : Number(rows[index]![18]) + Number(item.recorded_qty)
            rows[index]![19] =
              item.actual_qty !== 0
                ? Number(item.actual_qty)
                : Number(rows[index]![19]) + Number(item.actual_qty)
            rows[index]![20] = rows[index]![20]
              ? String(rows[index]![20]).includes(";")
                ? `${String(rows[index]![20])}` + ";" + `(${title})`
                : `(${String(rows[index]![20])})` + ";" + `(${title})`
              : title
          }

          if (item.reconciliation_category_id === 6) {
            rows[index]![21] =
              item.recorded_qty !== 0
                ? Number(item.recorded_qty)
                : Number(rows[index]![21]) + Number(item.recorded_qty)
            rows[index]![22] =
              item.actual_qty !== 0
                ? Number(item.actual_qty)
                : Number(rows[index]![22]) + Number(item.actual_qty)
            rows[index]![23] = rows[index]![23]
              ? String(rows[index]![23]).includes(";")
                ? `${String(rows[index]![23])}` + ";" + `(${title})`
                : `(${String(rows[index]![23])})` + ";" + `(${title})`
              : title
          }

          if (item.reconciliation_category_id === 7) {
            rows[index]![24] =
              item.recorded_qty !== 0
                ? Number(item.recorded_qty)
                : Number(rows[index]![24]) + Number(item.recorded_qty)
            rows[index]![25] =
              item.actual_qty !== 0
                ? Number(item.actual_qty)
                : Number(rows[index]![25]) + Number(item.actual_qty)
            rows[index]![26] = rows[index]![26]
              ? String(rows[index]![26]).includes(";")
                ? `${String(rows[index]![26])}` + ";" + `(${title})`
                : `(${String(rows[index]![26])})` + ";" + `(${title})`
              : title
          }
        } else {
          if (rows.length > 0) index++

          const row = [
            item.reconciliation_id,
            moment(item.start_date).format("DD/MM/YYYY"),
            moment(item.end_date).format("DD/MM/YYYY"),
            item.entity_name,
            item.material_name,
            item.activity_name,
            item.reconciliation_category_id === 1 ? item.recorded_qty : 0,
            item.reconciliation_category_id === 1 ? item.actual_qty : 0,
            item.reconciliation_category_id === 1 ? title : "",
            item.reconciliation_category_id === 2 ? item.recorded_qty : 0,
            item.reconciliation_category_id === 2 ? item.actual_qty : 0,
            item.reconciliation_category_id === 2 ? title : "",
            item.reconciliation_category_id === 3 ? item.recorded_qty : 0,
            item.reconciliation_category_id === 3 ? item.actual_qty : 0,
            item.reconciliation_category_id === 3 ? title : "",
            item.reconciliation_category_id === 4 ? item.recorded_qty : 0,
            item.reconciliation_category_id === 4 ? item.actual_qty : 0,
            item.reconciliation_category_id === 4 ? title : "",
            item.reconciliation_category_id === 5 ? item.recorded_qty : 0,
            item.reconciliation_category_id === 5 ? item.actual_qty : 0,
            item.reconciliation_category_id === 5 ? title : "",
            item.reconciliation_category_id === 6 ? item.recorded_qty : 0,
            item.reconciliation_category_id === 6 ? item.actual_qty : 0,
            item.reconciliation_category_id === 6 ? title : "",
            item.reconciliation_category_id === 7 ? item.recorded_qty : 0,
            item.reconciliation_category_id === 7 ? item.actual_qty : 0,
            item.reconciliation_category_id === 7 ? title : "",
            formatDateWithTimezone(item.created_at, timezone),
            item.created_by,
          ]

          rows.push(row)
        }
      }

      const cleanedRow = rows.map((row) => row.slice(1))

      await excelTemplate.addRows(
        c.var.t("reconciliation.label.title"),
        cleanedRow,
        3,
        "A"
      )

      const { buffer } = await excelTemplate.generate()
      if (!buffer) {
        throw new Error("Failed to generate Excel buffer")
      }

      const zip = new JSZip()
      const excelFileName = options.filename.replace(/\.zip$/i, ".xlsx")
      zip.file(excelFileName, Buffer.from(buffer as ArrayBuffer))

      const zipStream = zip.generateNodeStream({
        type: "nodebuffer",
        streamFiles: true,
      })
      const zipFilePath = options.original_filename
      const output = createWriteStream(zipFilePath)
      zipStream.pipe(output)
      await new Promise<void>((resolve) => output.on("finish", () => resolve()))

      const minioClient = createMinioClientFromEnv()
      if (!minioClient) {
        throw new Error("Failed to create MinIO client")
      }

      const bucketName = env.EXPORT_EXCEL_BUCKET_NAME
      const objectName = options.original_filename

      if (!(await minioClient.bucketExists(bucketName!))) {
        await minioClient.makeBucket(
          bucketName!,
          process.env.MINIO_REGION ?? "ap-southeast-3"
        )
      }

      await minioClient.putObject(
        bucketName!,
        objectName,
        createReadStream(zipFilePath)
      )

      unlinkSync(zipFilePath)

      const endpointUrl = `${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`
      const fileUrl = `${endpointUrl}/${bucketName}/${objectName}`

      const expiresAt = new Date()
      expiresAt.setDate(
        expiresAt.getDate() + (Number(env.EXPORT_EXCEL_EXPIRES_DAYS) || 7)
      )

      await this.exportHistoryRepo.upsert(
        c,
        {
          status: "done",
          download_url: fileUrl,
          expires_at: expiresAt,
        },
        options.export_id
      )

      console.log("✅ Download URL:", fileUrl)
    } catch (error) {
      await this.exportHistoryRepo.upsert(
        c,
        {
          status: "failed",
        },
        options.export_id
      )

      logger.error(`❌ Error exporting file: ${error}`)
    }
  }
}
