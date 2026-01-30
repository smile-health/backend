import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { BaseWorker } from "../base.worker.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { StockBookRepository } from "./stock-book.repository.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { MultiSheetZipExporter } from "@smile-health/lib/excel/multi-sheet-zip.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { StockBookQueryParams } from "./stock-book.schema.js"
import env from "../../config/env.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { Context } from "hono"
import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { buildStockBookExportOption } from "./stock-book.utils.js"

export class StockBookWorker extends BaseWorker {
  constructor(
    private readonly stockBookRepository: StockBookRepository,
    private readonly entityRepository: EntityRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository
  ) {
    super(exportHistoryRepo)
  }

  public registerWorkers(consumer: Consumer<DB>) {
    consumer.route(TOPIC.STOCK_BOOK_ALL_EXPORTED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      const { params, options, language, timezone } = parseMsg.payload

      await this.processAsyncExport(c, options, async () => {
        return await this.prepareExporter(c, language, timezone, params)
      })
    })
  }

  private async prepareExporter(
    c: CustomContext<DB>,
    language: string,
    timezone: string,
    queryParams: StockBookQueryParams
  ) {
    const { province_id, regency_id, month, year } = queryParams
    const childQueryParams = { ...queryParams }

    delete childQueryParams.entity_type_id
    if (!province_id && !regency_id) {
      childQueryParams.entity_type_ids = [
        ENTITY_TYPE.PROVINCE,
        ENTITY_TYPE.REGENCY,
      ]
    } else if (province_id && !regency_id) {
      childQueryParams.entity_type_ids = [ENTITY_TYPE.REGENCY]
    } else {
      childQueryParams.entity_type_ids = [
        ENTITY_TYPE.HEALTHCARE_FACILITY,
        ENTITY_TYPE.DISTRICT_HEALTH_CENTER,
      ]
    }

    const entityResult = await this.entityRepository.fetchEntities(
      c as Context,
      childQueryParams,
      { is_paginate: false }
    )
    const entitties = entityResult.records

    const exporter = new MultiSheetZipExporter({
      language,
      timezone,
      batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })

    for await (const entity of entitties) {
      queryParams.entity_id = entity.id
      const [stockBookTransactions, entityMaterialActivities] =
        await Promise.all([
          await this.stockBookRepository.fetchStockBook(
            c as Context,
            queryParams
          ),
          await this.stockBookRepository.fetchEntityMaterialActivity(
            c as Context,
            queryParams
          ),
        ])

      const options = buildStockBookExportOption(
        c as Context,
        stockBookTransactions,
        entityMaterialActivities,
        month,
        year
      )

      const groupId = entity.id.toString()
      await exporter.initFileGroupWarehouse(groupId, entity.name)

      for await (const option of options) {
        await exporter.initSheet(groupId, option.sheetName)
        await exporter.setTitleBar(
          groupId,
          option.sheetName,
          option.columns,
          option.titleBar
        )
        await exporter.setFilters(groupId, option.sheetName, option.filters)
        await exporter.setColumns(groupId, option.sheetName, option.columns)
        await exporter.addRows(
          groupId,
          option.sheetName,
          option.data as Record<string, unknown>[]
        )
      }
    }

    return exporter
  }
}
