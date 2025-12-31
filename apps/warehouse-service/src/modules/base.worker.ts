/* eslint-disable @typescript-eslint/no-unused-vars */
import { DB } from "@/common/infrastructure/database/types/db.js"
import env from "@/config/env.js"
import { BadRequestError } from "@smile/lib/error.js"
import { MultiSheetZipExporter } from "@smile/lib/excel/multi-sheet-zip.js"
import i18n from "@smile/lib/i18n.js"
import { logger } from "@smile/lib/logger.js"
import { createMinioClientFromEnv } from "@smile/lib/minio.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { Context } from "@smile/lib/types/context.js"
import ExportHistoryRepository from "./export-history/export-history.repository.js"

export class BaseWorker {
  constructor(protected readonly exportHistoryRepo?: ExportHistoryRepository) {}

  public registerWorkers(consumer: Consumer<DB>) {
    throw new BadRequestError("Not implemented")
  }

  public processAsyncExport = async (
    c: Context<DB>,
    options: { export_id: number; original_filename: string; language: string },
    exporterFunc: () => Promise<MultiSheetZipExporter>
  ) => {
    if (!this.exportHistoryRepo) {
      throw new BadRequestError("export history repo not yet initialized")
    }

    // set language
    const translator = i18n.cloneInstance()
    translator.changeLanguage(options.language)
    Object.assign(c.var, { t: translator.t })

    try {
      await this.exportHistoryRepo.upsert(
        c,
        {
          status: "in_progress",
        },
        options.export_id
      )

      const minioClient = createMinioClientFromEnv()
      if (!minioClient) {
        throw new Error("Failed to create MinIO client")
      }

      const exporter = await exporterFunc()
      const endpointUrl = `${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`
      const fileUrl = await exporter.exportToMinio(
        minioClient,
        endpointUrl,
        options.original_filename
      )

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

      console.log(error)
      logger.error(`❌ Error exporting file: ${error}`)
    }
  }

  public transformStream = <T, R>(
    source: AsyncIterable<T>,
    transform: (item: T) => R | Promise<R>
  ): AsyncIterableIterator<R> => {
    const generator = async function* () {
      for await (const item of source) {
        yield await transform(item)
      }
    }

    return generator()
  }
}
