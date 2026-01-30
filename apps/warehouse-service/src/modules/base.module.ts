/* eslint-disable @typescript-eslint/no-unused-vars */
import { DB } from "@/common/infrastructure/database/types/db.js"
import { BadRequestError } from "@smile-health/lib/error.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { randomUUID } from "crypto"
import { Context } from "hono"
import ExportHistoryRepository from "./export-history/export-history.repository.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"

export class BaseModule {
  constructor(
    protected readonly exportHistoryRepo?: ExportHistoryRepository,
    protected readonly publisher?: Publisher
  ) {}

  public registerWorkers(consumer: Consumer<DB>) {
    throw new BadRequestError("Not implemented")
  }

  public handleAsyncExport = async (
    c: Context,
    topic: string,
    body: { filename: string; params: object; ext?: string }
  ) => {
    if (!this.exportHistoryRepo) {
      throw new BadRequestError("export history repo not yet initialized")
    }

    if (!this.publisher) {
      throw new BadRequestError("publisher not yet initialized")
    }

    const { filename, params, ext } = body
    const extension = ext || "zip"
    let options = {
      original_filename: `${randomUUID()}.${extension}`,
      filename: `${filename}_${Date.now()}.${extension}`,
      export_id: 0,
      language: c.var.language,
    }

    const exportHistory = await this.exportHistoryRepo.upsert(c, {
      program_id: c.var.programId,
      original_filename: options.original_filename,
      filename: options.filename,
      created_by: c.var.user!["id"],
    })

    options = {
      ...options,
      export_id:
        "insertId" in exportHistory
          ? Number(exportHistory.insertId)
          : exportHistory.id,
    }

    const message = {
      headers: c.req.header(),
      payload: {
        params,
        options,
        config: c.var.config,
        language: c.var.language,
        timezone: c.req.header("Timezone"),
        programId: c.var.programId,
      },
    }

    await this.publisher.publish(topic, message)

    return { status: "success" }
  }
}
