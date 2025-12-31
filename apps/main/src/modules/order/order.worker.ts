import { DB, WsEntities } from "@/common/infrastructure/database/types/db.js"
import env from "@/config/env.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { Selectable } from "kysely"
import moment from "moment"
import momentTZ from "moment-timezone"
import { BaseWorker } from "../base.worker.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { OrderRepository } from "./order.repository.js"
import { GetOrderQueries } from "./order.schema.js"
import { ORDER_STATUS } from "@/common/constants/order.js"
import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { MultiSheetZipExporter } from "@smile/lib/excel/multi-sheet-zip.js"

export class OrderWorker extends BaseWorker {
  constructor(
    private readonly repo: OrderRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository
  ) {
    super(exportHistoryRepo)
  }

  public registerWorkers(consumer: Consumer<DB>) {
    consumer.route(TOPIC.ORDER_EXPORTED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      const {
        params,
        options,
        entityId,
        roleId,
        timezone,
        programId,
        userEntity,
        deviceType,
      } = parseMsg.payload

      await this.processAsyncExport(c, options, async () => {
        return await this.prepareExporter(
          c,
          options.language,
          timezone,
          params,
          entityId,
          roleId,
          programId,
          userEntity,
          deviceType
        )
      })
    })
  }

  private async prepareExporter(
    c: CustomContext<DB>,
    language: string,
    timezone: string,
    params: GetOrderQueries,
    entityId: number,
    roleId: number,
    programId: number,
    userEntity: Selectable<WsEntities>,
    deviceType: number
  ) {
    const exporter = new MultiSheetZipExporter({
      language,
      timezone: timezone,
      batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })

    const orderGroup = {
      id: "orders",
      name: c.var.t("order.export.group_name"),
      sheets: {
        items: { sheetName: c.var.t("order.export.sheet.items") },
      },
      columns: {
        items: [
          { header: c.var.t("order.label.order_id"), width: 15 },
          { header: c.var.t("order.label.status"), width: 15 },
          { header: c.var.t("order.label.customer_name"), width: 50 },
          { header: c.var.t("order.label.vendor_name"), width: 50 },
          { header: c.var.t("order.label.material_name_kfa"), width: 40 },
          { header: c.var.t("order.label.material_name"), width: 40 },
          { header: c.var.t("order.label.order_item_reason"), width: 30 },
          { header: c.var.t("order.label.total_order_item"), width: 20 },
          { header: c.var.t("order.label.total_fulfilled_item"), width: 15 },
          { header: c.var.t("order.label.activity_name"), width: 15 },
          { header: c.var.t("order.label.created_by"), width: 25 },
          { header: c.var.t("order.label.created_at"), width: 15 },
          { header: c.var.t("order.label.updated_at"), width: 15 },
          { header: c.var.t("order.label.updated_by"), width: 25 },
          { header: c.var.t("order.label.batch"), width: 15 },
          { header: c.var.t("order.label.expired_date_batch"), width: 15 },
          { header: c.var.t("order.label.allocated_qty"), width: 15 },
          { header: c.var.t("order.label.delivery_type"), width: 15 },
          { header: c.var.t("order.label.delivery_type"), width: 15 },
          { header: c.var.t("order.label.no_document"), width: 30 },
          { header: c.var.t("order.label.release_date"), width: 15 },
          { header: c.var.t("order.label.notes"), width: 40 },
          { header: c.var.t("order.label.total_confirmed_item"), width: 20 },
          { header: c.var.t("order.label.shipped_comment"), width: 40 },
          { header: c.var.t("order.label.confirmed_comment"), width: 40 },
          { header: c.var.t("order.label.confirmed_at"), width: 15 },
          { header: c.var.t("order.label.allocated_at"), width: 15 },
          { header: c.var.t("order.label.shipped_at"), width: 15 },
        ],
      },
    }

    exporter.initFileGroup(orderGroup.id, orderGroup.name)
    await exporter.initSheet(orderGroup.id, orderGroup.sheets.items.sheetName)
    exporter.setColumns(
      orderGroup.id,
      orderGroup.sheets.items.sheetName,
      orderGroup.columns.items
    )

    // Fetch data stream
    const stream = await this.repo.getListOrderStreamV2(
      c,
      params,
      entityId,
      roleId,
      programId,
      userEntity,
      deviceType
    )
    console.log("stream", stream)

    const batchSize = env.EXPORT_EXCEL_BATCH_SIZE || 100000
    let batch: any[] = []
    const canceledOrders: Record<number, any[]> = {}

    for await (const item of stream) {
      const isTargetStatus = [
        ORDER_STATUS.DRAFT,
        ORDER_STATUS.PENDING,
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.CANCELED,
      ].includes(item.status_id)

      const isVariant = item.material_level_id_child === KFA_LEVEL_ID.VARIANT

      if (item.status_id === ORDER_STATUS.CANCELED) {
        if (!canceledOrders[item.id]) canceledOrders[item.id] = []
        canceledOrders[item.id].push(item)
        continue
      }

      const shouldInclude = isTargetStatus || (isVariant && item.stock_id)
      if (!shouldInclude) continue

      const row = this.buildRow(item, timezone, c)
      batch.push(row)

      if (batch.length >= batchSize) {
        await exporter.addRows(
          orderGroup.id,
          orderGroup.sheets.items.sheetName,
          batch
        )
        batch = []
      }
    }

    for (const orderId in canceledOrders) {
      const items = canceledOrders[orderId]

      const variantItem = items.find(
        (i) => i.material_level_id_child === KFA_LEVEL_ID.VARIANT
      )
      const selected = variantItem
        ? variantItem
        : items.find(
            (i) => i.material_level_id_parent === KFA_LEVEL_ID.TEMPLATE
          )

      if (selected) {
        const row = this.buildRow(selected, timezone, c)
        batch.push(row)

        if (batch.length >= batchSize) {
          await exporter.addRows(
            orderGroup.id,
            orderGroup.sheets.items.sheetName,
            batch
          )
          batch = []
        }
      }
    }

    if (batch.length > 0) {
      await exporter.addRows(
        orderGroup.id,
        orderGroup.sheets.items.sheetName,
        batch
      )
    }

    return exporter
  }

  private buildRow(item: any, timezone: string, c: CustomContext<DB>) {
    return {
      order_id: item.id,
      status: item.status ? c.var.t(`order.label.${item.status}`) : "",
      customer_name: item.customer_name,
      vendor_name: item.vendor_name,
      material_name_kfa: item.material_name_kfa,
      material_name: item.material_name,
      order_item_reason: item.reason
        ? c.var.t(`order_reason.label.${item.reason}`)
        : "",
      total_order_item: item.ordered_qty,
      received_qty: item.received_qty,
      activity_name: item.activity_name,
      created_by: item.created_by,
      created_at: momentTZ(item.created_at)
        .tz(timezone)
        .format("YYYY-MM-DD HH:mm:ss"),
      updated_at: momentTZ(item.updated_at)
        .tz(timezone)
        .format("YYYY-MM-DD HH:mm:ss"),
      updated_by: item.updated_by,
      batch: item.code_batch,
      expired_date_batch: item.expired_date_batch
        ? moment(item.expired_date_batch).format("DD/MM/YYYY")
        : "",
      allocated_qty: item.allocated_qty,
      delivery_number: item.delivery_number,
      delivery_type: item.delivery_type_name,
      no_document: item.no_document,
      release_date: item.released_date
        ? moment(item.released_date).format("DD/MM/YYYY")
        : "",
      notes: item.notes,
      total_confirmed_item: item.confirmed_qty,
      shipped_comment: item.comment_shipped,
      confirmed_comment: item.comment_confirmed,
      confirmed_at: item.confirmed_at
        ? moment(item.confirmed_at).format("DD/MM/YYYY")
        : "",
      allocated_at: item.allocated_at
        ? moment(item.allocated_at).format("DD/MM/YYYY")
        : "",
      shipped_at: item.shipped_at
        ? moment(item.shipped_at).format("DD/MM/YYYY")
        : "",
    }
  }
}
