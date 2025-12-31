import BaseTemplate from "@smile/lib/excel/index.js"
import { Context } from "hono"
import { NotFoundError, ValidationError } from "@smile/lib/error.js" // Removed ValidationError as it's unused
import {
  SelfDisposalRequest,
  SelfDisposalListPaginatedRequestDTO,
} from "./self-disposal.schema.js"
import { SelfDisposalRepository } from "./self-disposal.repository.js"
import { SelfDisposalPublisher } from "./self-disposal.publisher.js"
import { EXTERMINATION_TRANSACTION_TYPE } from "./self-disposal.constants.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { EntityRepository } from "../../entity/entity.repository.js"
import { MaterialRepository } from "../../material/material.repository.js"
import { UserRepository } from "../../user/user.repository.js"
import { associate, collect, mapAsyncIterable, pick } from "@smile/lib/utils.js"
import { ActivityRepository } from "@/modules/activity/activity.repository.js"

export class SelfDisposalModule {
  constructor(
    private readonly repository: SelfDisposalRepository,
    private readonly publisher: SelfDisposalPublisher,
    private readonly entityRepo: EntityRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly userRepo: UserRepository,
    private readonly activityRepo: ActivityRepository
  ) {}

  async selfDisposal(c: Context, body: SelfDisposalRequest) {
    const {
      entity_id,
      activity_id,
      disposal_method_id,
      disposal_items,
      report_number, // report_number is used in the createDisposalTransaction, so it's not unused
      comment, // comment is used in the createDisposalTransaction, so it's not unused
    } = body

    // Validate entity exists
    const entity = await this.repository.findEntityById(
      c,
      Number(entity_id) || 0
    )
    if (!entity) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("common.entity"),
        })
      )
    }

    // Process disposal items (transaction is already handled at the middleware level)
    const disposalTransactionIds: number[] = []

    // Process each disposal item (each item represents a stock/batch)
    for (const item of disposal_items) {
      // Validate stock exists and has sufficient quantity
      const getDisposalStock =
        await this.repository.findDisposalStockByIdAndTransactionReason(
          c,
          item.disposal_stock_id,
          item.transaction_reason_id
        )

      if (!getDisposalStock) {
        throw new NotFoundError(
          c.var.t("validator.not_exist", {
            field: c.var.t("disposal.label.disposal_stock"),
          })
        )
      }

      const currentDisposalDiscardQty =
        getDisposalStock.disposal_discard_qty ?? 0
      const currentDisposalReceivedQty =
        getDisposalStock.disposal_received_qty ?? 0
      const currentDisposalQty = getDisposalStock.disposal_qty ?? 0

      if (currentDisposalDiscardQty - item.disposal_discard_qty < 0) {
        throw new ValidationError(
          `${c.var.t("download-report.category.discard")} Disposal ${c.var.t("validator.have_no_stock_must_zero")}`
        )
      } else if (currentDisposalReceivedQty - item.disposal_received_qty < 0) {
        throw new ValidationError(
          `${c.var.t("reconciliation.label.category.received")} Disposal ${c.var.t("validator.have_no_stock_must_zero")}`
        )
      }

      // Create disposal stock record
      await this.repository.updateDisposalStock(c, getDisposalStock.id, {
        stock_id: Number(item.disposal_stock_id) || 0,
        transaction_reason_id: Number(item.transaction_reason_id) || 0,
        disposal_discard_qty:
          currentDisposalDiscardQty - Number(item.disposal_discard_qty) || 0,
        disposal_received_qty:
          currentDisposalReceivedQty - Number(item.disposal_received_qty) || 0,
        disposal_qty:
          currentDisposalQty +
            Number(item.disposal_discard_qty) +
            Number(item.disposal_received_qty) || 0,
      })

      // Calculate opening quantity and change
      const openingQty =
        (getDisposalStock.disposal_discard_qty || 0) +
        (getDisposalStock.disposal_received_qty || 0)
      const changeQty = -(
        item.disposal_discard_qty + item.disposal_received_qty
      )

      // Create disposal transaction record
      const disposalTransaction =
        await this.repository.createDisposalTransaction(c, {
          disposal_transaction_type_id:
            EXTERMINATION_TRANSACTION_TYPE.INDEPENDENT_EXTERMINATION, // Self disposal type
          disposal_method_id: disposal_method_id,
          entity_id: Number(entity_id) || 0,
          activity_id: Number(activity_id) || 0,
          material_id: Number(getDisposalStock.material_id) || 0,
          stock_disposal_id: getDisposalStock.id || 0,
          opening_qty: openingQty || 0,
          change_qty: changeQty || 0,
          disposal_discard_qty: item.disposal_discard_qty || 0,
          disposal_received_qty: item.disposal_received_qty || 0,
          open_vial: 0, // Default value
          report_number: report_number, // Pass report_number
          comment: comment, // Pass comment
        })

      const transactionId = disposalTransaction.insertId
        ? Number(disposalTransaction.insertId)
        : 0
      if (transactionId && transactionId > 0) {
        disposalTransactionIds.push(transactionId)
      }
    }

    // Publish disposal events
    if (disposalTransactionIds.length > 0) {
      await this.publisher.processCreate(
        c,
        disposalTransactionIds.map((id) => ({ id }))
      )
    }

    return {
      success: true,
      message: "Self disposal completed successfully",
    }
  }

  async getDisposalList(
    c: Context,
    params: SelfDisposalListPaginatedRequestDTO
  ) {
    // add custom params, filter only self-disposal
    const { data: basicData, total } = await this.repository.findAll(c, params)

    if (basicData.length === 0) {
      return new PaginatedResponse(params)
    }
    const entityIds = collect(basicData, "entity_id")
    const materialIds = collect(basicData, "material_id")
    const userCreatedIds = collect(basicData, "created_by")
    const userUpdatedIds = collect(basicData, "updated_by")
    const activityIds = collect(basicData, "activity_id")
    const disposalStockIds = collect(basicData, "stock_disposal_id")

    const [
      mapEntities,
      materials,
      mapUsersCreated,
      mapUsersUpdated,
      mapActivities,
      mapDisposalStocks,
    ] = await Promise.all([
      this.entityRepo.getBasicDetailMapped(c, entityIds),
      this.materialRepo.findWithDetails(c, materialIds),
      this.userRepo.getBasicDetailMappedGeneric(c, userCreatedIds, "ws_users"),
      this.userRepo.getBasicDetailMappedGeneric(c, userUpdatedIds, "ws_users"),
      this.activityRepo.getActivityMapped(c, activityIds),
      this.repository.getBasicDetailMapped(c, disposalStockIds),
    ])
    const mapMaterials = associate(materials, "id")

    const list = await Promise.all(
      basicData.map((res) => ({
        ...pick(res, [
          "id",
          "entity_id",
          "activity_id",
          "report_number",
          "created_by",
          "updated_by",
          "created_at",
          "stock_disposal_id",
          "opening_qty",
          "change_qty",
          "disposal_discard_qty",
          "disposal_received_qty",
          "closing_qty",
          "comment",
          "disposal_transaction_type_id",
          "disposal_transaction_type",
          "disposal_method_id",
        ]),
        disposal_method: {
          id: res.disposal_method_id,
          title: c.var.t(`disposal_method.${res.disposal_method_title}`),
        },
        entity: mapEntities[res.entity_id ?? 0],
        material: mapMaterials[res.material_id ?? 0],
        material_id: res.material_id,
        transaction_reason: {
          id: res.transaction_reason_id,
          title: res.transaction_reason_title
            ? c.var.t(`transaction.reason.${res.transaction_reason_title}`)
            : res.transaction_reason_title,
        },
        activity: mapActivities[res.activity_id ?? 0],
        user_created: mapUsersCreated[res.created_by ?? 0],
        user_updated: mapUsersUpdated[res.updated_by ?? 0],
        disposal_stock: mapDisposalStocks[res.stock_disposal_id ?? 0],
      }))
    )

    return new PaginatedResponse(params, list, total)
  }

  async exportExcel(c: Context, params: SelfDisposalListPaginatedRequestDTO) {
    // TODO: Implement Excel export functionality
    const excelTemplate = new BaseTemplate()
    const { t, language } = c.var
    const title = t("disposal_method.self_disposal")
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    excelTemplate.setLanguage(language)

    await excelTemplate.initSheet(title)
    excelTemplate.setColumns(
      [
        { header: t("transaction.export.entity_id"), width: 10 },
        { header: t("transaction.export.entity_name"), width: 30 },
        { header: t("stock.sheet.province"), width: 20 },
        { header: t("stock.sheet.regency"), width: 20 },
        { header: t("stock.sheet.sub_district"), width: 20 },
        { header: t("stock.sheet.entity_type"), width: 10 },
        { header: t("transaction.export.material_id"), width: 10 },
        { header: t("transaction.export.material_name"), width: 15 },
        { header: t("stock.sheet.material_code"), width: 15 },
        { header: t("transaction.export.batch_code"), width: 10 },
        { header: t("transaction.export.batch_expired_date"), width: 20 },
        { header: t("transaction.export.manufacture_name"), width: 20 },
        { header: t("transaction.export.transaction_reason_title"), width: 20 },
        { header: t("transaction.export.activity_name"), width: 15 },
        { header: t("transaction.export.opening_qty"), width: 15 },
        { header: t("transaction.export.change_qty"), width: 10 },
        { header: t("transaction.export.closing_qty"), width: 15 },
        { header: t("disposal.export.stock_activity_name"), width: 20 },
        { header: t("disposal.export.disposal_method_name"), width: 15 },
        { header: t("disposal.export.report_number"), width: 20 },
        { header: t("transaction.export.created_by_fullname"), width: 20 },
        { header: t("transaction.export.created_at"), width: 15 },
        { header: t("disposal.export.updated_at"), width: 15 },
        { header: t("disposal.export.updated_by_fullname"), width: 20 },
      ],
      "A1",
      title
    )

    const stream = await this.repository.getStreamData(c, params)

    const data = mapAsyncIterable(stream, (item) => {
      return {
        entity_id: item.entity_id,
        entity: item.entity,
        province: item.province,
        regency: item.regency,
        subdistrict: item.subdistrict,
        entity_tag: item.entity_tag,
        material_id: item.material_id,
        material: item.material,
        material_code: item.material_code,
        batch_code: item.batch_code,
        expired_date: item.expired_date,
        manufacture_name: item.manufacture_name,
        transaction_reason: c.var.t(
          `transaction.reason.${item.transaction_reason}`
        ),
        activity: item.activity,
        opening_qty: item.opening_qty,
        change_qty: item.change_qty,
        closing_qty: item.closing_qty,
        stock_activity: item.stock_activity,
        disposal_method_title: c.var.t(
          `disposal_method.${item.disposal_method_title}`
        ),
        report_number: item.report_number,
        user_created_fullname: item.user_created_fullname,
        created_at: item.created_at,
        updated_at: item.updated_at,
        user_updated_fullname: item.user_updated_fullname,
      }
    })

    await excelTemplate.addRows(title, data)

    return await excelTemplate.generate()
  }
}
