import { slave } from "@/common/infrastructure/database/slave.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { MultiSheetZipExporter } from "@smile/lib/excel/multi-sheet-zip.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { collect, formatDateWithTimezone } from "@smile/lib/utils.js"
import { Context } from "hono"
import env from "../../config/env.js"
import { BaseWorker } from "../base.worker.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { TransactionRepository } from "./transaction.repository.js"
import {
  PublishTrxDTO,
  TransactionListPaginatedRequestDTO,
  UpsertTransactionListDTO,
} from "./transaction.schema.js"

export class TransactionWorker extends BaseWorker {
  constructor(
    private readonly repo: TransactionRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository
  ) {
    super(exportHistoryRepo)
  }

  public registerWorkers(consumer: Consumer<DB>) {
    consumer.route(TOPIC.TRANSACTION_CREATED, async (c, msg) => {
      const { payload } = JSON.parse(msg ?? "{}") as {
        payload: PublishTrxDTO[]
      }

      const details = await this.repo.getMapDetails(c, collect(payload, "id"))

      const data = payload.map((trx) => ({
        ...(details[trx.id] as object),
        transaction_ids: trx.transaction_ids,
        discard: trx.discard,
        rabies: trx.rabies,
      }))

      for (const trx of data) {
        await this.syncToClickhouse(c, trx)

        if (trx.discard) {
          const discardTrx = await this.repo.findDetailById(
            c as Context,
            trx.discard.id
          )
          if (discardTrx) await this.syncToClickhouse(c, discardTrx)
        }
      }
    })

    consumer.route(TOPIC.TRANSACTION_EXPORTED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      const { params, options, language, timezone, config, programName } =
        parseMsg.payload

      await this.processAsyncExport(c, options, async () => {
        return await this.prepareExporter(
          c,
          language,
          timezone,
          params,
          typeof config === "string" ? JSON.parse(config) : config,
          programName
        )
      })
    })
  }

  private async syncToClickhouse(
    c: CustomContext<DB>,
    payload: UpsertTransactionListDTO
  ) {
    return await this.repo.insertTransactionList(payload)
  }

  private buildRowExcel(
    translate,
    isHierarchyEnabled,
    programName,
    timezone,
    item
  ) {
    return {
      entity_id: item.entity_id,
      entity_name: item.entity_name,
      ...(isHierarchyEnabled
        ? {
            parent_material_id: item.parent_material_id,
            parent_material_name: item.parent_material_name,
          }
        : {}),
      material_id: item.material_id,
      material_name: item.material_name,
      activity_name: item.activity_name,
      opening_qty: item.opening_qty,
      change_qty: item.change_qty,
      closing_qty: item.closing_qty,
      transaction_type_title: translate(
        `transaction.type.${item.transaction_type_id}`
      ),
      transaction_reason_title: item.transaction_reason_title
        ? translate(`transaction.reason.${item.transaction_reason_title}`)
        : item.transaction_reason_title,
      customer_name: item.companion_entity_id
        ? item.companion_entity_name
        : item.customer_name,
      vendor_name: item.companion_entity_id
        ? item.entity_name
        : item.vendor_name,
      order_id: item.order_id,
      order_status_label: item.order_status_label
        ? translate(`order.status.${item.order_status_label}`)
        : item.order_status_label,
      order_type_label: item.order_type_label
        ? translate(`order.type.${item.order_type_label}`)
        : item.order_type_label,
      stock_activity_name: item.stock_activity_name,
      stock_allocated_qty: item.stock_allocated_qty,
      batch_code: item.batch_code,
      batch_expired_date: item.batch_expired_date,
      manufacture_name: item.manufacture_name,
      actual_transaction_date: item.actual_transaction_date
        ? new Date(item.actual_transaction_date).toISOString().split("T")[0]
        : null,
      source_program_name: programName,
      source_activity_name: item.activity_name,
      companion_program_name: item.companion_program_name ?? null,
      companion_activity_name: item.companion_activity_name ?? null,
      created_by_fullname:
        `${item.created_by_firstname ?? ""} ${item.created_by_lastname ?? ""}`.trim(),
      created_at: formatDateWithTimezone(item.created_at, timezone),
    }
  }

  private async prepareExporter(
    c: CustomContext<DB>,
    language: string,
    timezone: string,
    params: TransactionListPaginatedRequestDTO,
    config: { material: { is_hierarchy_enabled?: boolean } },
    programName: string
  ) {
    try {
      const isHierarchyEnabled = config.material.is_hierarchy_enabled ?? false
      const exporter = new MultiSheetZipExporter({
        language,
        timezone: timezone,
        batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
        bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
      })

      const transactionsGroup = {
        id: "transactions",
        name: c.var.t("transaction.export.title"),
        sheets: {
          transaction: { sheetName: c.var.t("transaction.export.title") },
        },
        columns: {
          transaction: [
            { header: c.var.t("transaction.export.entity_id"), width: 10 },
            { header: c.var.t("transaction.export.entity_name"), width: 40 },
            ...(isHierarchyEnabled
              ? [
                  {
                    header: c.var.t("transaction.export.parent_material_id"),
                    width: 10,
                  },
                  {
                    header: c.var.t("transaction.export.parent_material_name"),
                    width: 40,
                  },
                ]
              : []),
            { header: c.var.t("transaction.export.material_id"), width: 10 },
            { header: c.var.t("transaction.export.material_name"), width: 40 },
            { header: c.var.t("transaction.export.activity_name"), width: 20 },
            { header: c.var.t("transaction.export.opening_qty"), width: 15 },
            { header: c.var.t("transaction.export.change_qty"), width: 10 },
            { header: c.var.t("transaction.export.closing_qty"), width: 15 },
            {
              header: c.var.t("transaction.export.transaction_type_title"),
              width: 20,
            },
            {
              header: c.var.t("transaction.export.transaction_reason_title"),
              width: 20,
            },
            { header: c.var.t("transaction.export.customer_name"), width: 20 },
            { header: c.var.t("transaction.export.vendor_name"), width: 20 },
            { header: c.var.t("transaction.export.order_id"), width: 20 },
            {
              header: c.var.t("transaction.export.order_status_label"),
              width: 20,
            },
            { header: c.var.t("transaction.export.order_type"), width: 20 },
            {
              header: c.var.t("transaction.export.stock_activity_name"),
              width: 20,
            },
            {
              header: c.var.t("transaction.export.stock_allocated_qty"),
              width: 15,
            },
            { header: c.var.t("transaction.export.batch_code"), width: 20 },
            {
              header: c.var.t("transaction.export.batch_expired_date"),
              width: 20,
            },
            {
              header: c.var.t("transaction.export.manufacture_name"),
              width: 20,
            },
            {
              header: c.var.t("transaction.export.actual_transaction_date"),
              width: 20,
            },
            {
              header: c.var.t("transaction.export.source_program"),
              width: 20,
            },
            {
              header: c.var.t("transaction.export.source_activity"),
              width: 20,
            },
            {
              header: c.var.t("transaction.export.companion_program"),
              width: 20,
            },
            {
              header: c.var.t("transaction.export.companion_activity"),
              width: 20,
            },
            {
              header: c.var.t("transaction.export.created_by_fullname"),
              width: 20,
            },
            { header: c.var.t("transaction.export.created_at"), width: 20 },
          ],
        },
      }

      exporter.initFileGroup(transactionsGroup.id, transactionsGroup.name)
      await exporter.initSheet(
        transactionsGroup.id,
        transactionsGroup.sheets.transaction.sheetName
      )
      exporter.setColumns(
        transactionsGroup.id,
        transactionsGroup.sheets.transaction.sheetName,
        transactionsGroup.columns.transaction
      )

      Object.assign(c.var, { slave })
      const transactionData = await this.repo.getTransactionList(
        c as Context,
        params
      )
      for await (const data of transactionData) {
        if (data instanceof Array) {
          const items = data.flat()

          const rows = items.map(({ text: item }) =>
            this.buildRowExcel(
              c.var.t,
              isHierarchyEnabled,
              programName,
              timezone,
              item
            )
          )

          await exporter.addRows(
            transactionsGroup.id,
            transactionsGroup.sheets.transaction.sheetName,
            rows
          )
        } else {
          await exporter.addRow(
            transactionsGroup.id,
            transactionsGroup.sheets.transaction.sheetName,
            this.buildRowExcel(
              c.var.t,
              isHierarchyEnabled,
              programName,
              timezone,
              data
            )
          )
        }
      }
      return exporter
    } catch (error) {
      console.error("Error exporting transaction data:", error)
      throw error
    }
  }
}
