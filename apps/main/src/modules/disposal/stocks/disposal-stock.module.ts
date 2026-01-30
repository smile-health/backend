import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { associate, collect, group, pick } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import _ from "lodash"
import { EntityRepository } from "../../entity/entity.repository.js"
import { MaterialRepository } from "../../material/material.repository.js"
import { DisposalStockRepository } from "./disposal-stock.repository.js"
import { GetDisposalStocksQueries } from "./disposal-stock.schema.js"

export class DisposalStockModule {
  constructor(
    private readonly disposalStockRepo: DisposalStockRepository,
    private readonly entityRepo: EntityRepository,
    private readonly materialRepo: MaterialRepository
  ) {}

  async list(c: Context, params: GetDisposalStocksQueries) {
    const { data, total } = await this.disposalStockRepo.findAll(c, params)
    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    // For disposal stock, we can return data directly as no extra enrichment needed for now
    const entityIds = collect(data, "entity_id")
    const materialIds = collect(data, "f_material_id") as number[]

    const [mapEntities, materials] = await Promise.all([
      this.entityRepo.getBasicDetailMapped(c, entityIds),
      this.materialRepo.findWithDetails(c, materialIds),
    ])
    const mapMaterials = associate(materials, "id")

    const list = await Promise.all(
      data.map(async (res) => ({
        ...pick(res, [
          "stock_update",
          "entity_id",
          "total_disposal_qty",
          "total_disposal_discard_qty",
          "total_disposal_received_qty",
          "total_disposal_shipped_qty",
        ]),
        entity: mapEntities[res.entity_id ?? 0],
        material: mapMaterials[res.f_material_id ?? 0],
        material_id: res.f_material_id,
        details: await this.stockList(c, {
          entity_id: res.entity_id ?? 0,
          ...(params.material_level_id === KFA_LEVEL_ID.VARIANT
            ? {
                material_id: res.f_material_id,
              }
            : {
                parent_material_id: res.f_material_id,
              }),
          activity_id: params.activity_id,
          group_by: "material",
          only_have_qty: params.only_have_qty,
          expired_from: params.expired_from,
          expired_to: params.expired_to,
          batch_ids: params.batch_ids,
        }),
      }))
    )
    return new PaginatedResponse(params, list, total)
  }

  async stockList(c: Context, params: GetDisposalStocksQueries) {
    const allStocks = await this.disposalStockRepo.findDetails(c, params)
    if (allStocks.length === 0) {
      return []
    }
    // mapping per stock_id
    const mapStocks = group(allStocks, "stock_id")

    return Object.entries(mapStocks).map(([id, stocks]) => ({
      stock_id: stocks[0].stock_id,
      batch_id: stocks[0].batch_id,
      activity_id: stocks[0].activity_id,
      material_id: stocks[0].material_id,
      material_name: stocks[0].material_name,
      disposal_qty: _.sumBy(stocks, "disposal_qty") ?? 0,
      disposal_discard_qty: _.sumBy(stocks, "disposal_discard_qty") ?? 0,
      disposal_received_qty: _.sumBy(stocks, "disposal_received_qty") ?? 0,
      disposal_shipped_qty: _.sumBy(stocks, "disposal_shipped_qty") ?? 0,
      min: _.maxBy(stocks, "min")?.min,
      max: _.maxBy(stocks, "max")?.max,
      updated_at: _.maxBy(stocks, "updated_at")?.updated_at,
      batch: stocks[0].batch,
      activity: stocks[0].activity,
      stocks: allStocks
        .filter((el) => el.stock_id == id)
        .map((stock) => ({
          ...pick(stock, [
            "stock_id",
            "disposal_stock_id",
            "disposal_qty",
            "disposal_discard_qty",
            "disposal_received_qty",
            "disposal_shipped_qty",
            "updated_at",
            "transaction_reason_id",
            "transaction_reason",
          ]),
        })),
    }))
  }

  async stockDetails(c: Context, params: GetDisposalStocksQueries) {
    const allStocks = await this.disposalStockRepo.findDetails(c, params)
    if (allStocks.length === 0) {
      return []
    }
    const [materials, historyDisposal] = await Promise.all([
      this.materialRepo.findWithDetails(c, collect(allStocks, "material_id")),
      this.disposalStockRepo.getHistoryDisposal(c, {
        materialIds: collect(allStocks, "material_id"),
        entityIds: collect(allStocks, "entity_id"),
      }),
    ])
    // mapping per stock_id
    const mapHistoryPerMaterials = group(historyDisposal, "material_id")
    const mapStockPerMaterials = group(allStocks, "material_id")
    const mapMaterials = associate(materials, "id")
    const mapStockPerBatch = group(allStocks, "stock_id")

    return Object.entries(mapStockPerMaterials).map(([id, stocks]) => {
      return {
        // get material childs
        material_id: stocks[0].material_id,
        material: mapMaterials[id],
        disposal_qty: _.sumBy(stocks, "disposal_qty") ?? 0,
        disposal_discard_qty: _.sumBy(stocks, "disposal_discard_qty") ?? 0,
        disposal_received_qty: _.sumBy(stocks, "disposal_received_qty") ?? 0,
        disposal_shipped_qty: _.sumBy(stocks, "disposal_shipped_qty") ?? 0,
        min: _.maxBy(stocks, "min")?.min,
        max: _.maxBy(stocks, "max")?.max,
        updated_at: _.maxBy(stocks, "updated_at")?.updated_at,
        history: {
          total_disposal_shipment:
            mapHistoryPerMaterials[id]?.find(
              (item) => item.disposal_transaction_type_id === 1
            )?.total || 0, // total disposal shipment
          total_self_disposal:
            mapHistoryPerMaterials[id]?.find(
              (item) => item.disposal_transaction_type_id === 3
            )?.total || 0, // total self disposal
        },
        stocks: Object.entries(mapStockPerBatch)
          .filter(([_, items]) => items.some((item) => item.material_id == id))
          .map(([stock_id, stockBatches]) => ({
            id: parseInt(stock_id),
            material_id: stockBatches[0]?.material_id,
            activity: stockBatches[0]?.activity,
            disposal_qty: _.sumBy(stockBatches, "disposal_qty") ?? 0,
            disposal_discard_qty:
              _.sumBy(stockBatches, "disposal_discard_qty") ?? 0,
            disposal_received_qty:
              _.sumBy(stockBatches, "disposal_received_qty") ?? 0,
            disposal_shipped_qty:
              _.sumBy(stockBatches, "disposal_shipped_qty") ?? 0,
            batch: stockBatches[0]?.batch,
            updated_at: _.maxBy(stockBatches, "updated_at")?.updated_at,
            disposals: stockBatches.map((stock) => ({
              ...pick(stock, [
                "material_id",
                "stock_id",
                "disposal_stock_id",
                "disposal_qty",
                "disposal_discard_qty",
                "disposal_received_qty",
                "disposal_shipped_qty",
                "updated_at",
              ]),
              transaction_reason: stock.transaction_reason
                ? {
                    id: stock.transaction_reason.id,
                    title: c.var.t(
                      `transaction.reason.${stock.transaction_reason.title}`
                    ),
                  }
                : stock.transaction_reason,
            })),
          })),
      }
    })
  }

  async details(c: Context, params: GetDisposalStocksQueries) {
    const { data, total } = await this.disposalStockRepo.findAll(c, params)
    if (data.length === 0) {
      return new PaginatedResponse(params)
    }
    const entityIds = collect(data, "entity_id")
    const materialIds = collect(data, "f_material_id") as number[]

    const [mapEntities, materials] = await Promise.all([
      this.entityRepo.getBasicDetailMapped(c, entityIds),
      this.materialRepo.findWithDetails(c, materialIds),
    ])
    const mapMaterials = associate(materials, "id")

    const isHierarchy =
      (c.var.config?.material.is_hierarchy_enabled &&
        params.material_level_id !== KFA_LEVEL_ID.VARIANT) ??
      false

    const list = await Promise.all(
      data.map(async (res) => ({
        ...pick(res, [
          "parent_material_id",
          "updated_at",
          "entity_id",
          "total_disposal_qty",
          "total_disposal_discard_qty",
          "total_disposal_received_qty",
          "total_disposal_shipped_qty",
          "min",
          "max",
        ]),
        material_id: res.f_material_id,
        entity: mapEntities[res.entity_id ?? 0],
        material: mapMaterials[res.f_material_id ?? 0],
        details: await this.stockDetails(c, {
          entity_id: res.entity_id ?? 0,
          offset: 0,
          paginate: 1000,
          ...(!isHierarchy
            ? {
                material_id: [res.f_material_id].filter(
                  (id): id is number => typeof id === "number"
                ),
              }
            : {
                parent_material_id: res.f_material_id,
              }),
          activity_id: params.activity_id,
          only_have_qty: params.only_have_qty,
          expired_from: params.expired_from,
          expired_to: params.expired_to,
          batch_ids: params.batch_ids,
        }),
      }))
    )
    return new PaginatedResponse(params, list, total)
  }

  async export(c: Context, params: GetDisposalStocksQueries) {
    const excelTemplate = new BaseTemplate()
    const { t, language } = c.var
    const title = t("stock.export.disposal_title")
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    excelTemplate.setLanguage(language)

    await excelTemplate.initSheet(title)
    excelTemplate.setColumns(
      [
        { header: "No", width: 10 },
        { header: t("stock.sheet.material_name_template"), width: 50 },
        { header: t("stock.sheet.material_code"), width: 30 },
        { header: t("stock.sheet.material_name_variant"), width: 50 },
        { header: t("stock.sheet.entity_id"), width: 10 },
        { header: t("stock.sheet.entity_name"), width: 40 },
        { header: t("stock.sheet.province"), width: 30 },
        { header: t("stock.sheet.regency"), width: 30 },
        { header: t("stock.sheet.sub_district"), width: 30 },
        { header: t("stock.sheet.entity_type"), width: 10 },
        { header: t("stock.sheet.batch_code"), width: 15 },
        { header: t("stock.sheet.expired_date"), width: 20 },
        { header: t("stock.sheet.activity"), width: 15 },
        { header: t("stock.sheet.disposal_qty"), width: 10 },
        { header: t("stock.sheet.disposal_discard_qty"), width: 10 },
        { header: t("stock.sheet.disposal_received_qty"), width: 10 },
        { header: t("stock.sheet.disposal_shipped_qty"), width: 10 },
        { header: t("stock.sheet.transaction_reason"), width: 10 },
        { header: t("stock.sheet.budget_source"), width: 10 },
        { header: t("common.updated_at"), width: 20 },
      ],
      "A1",
      title
    )

    const stream = await this.disposalStockRepo.getStreamData(c, params)

    const rows: object[] = []
    let index: number = 1
    for await (const row of stream) {
      rows.push({
        no: index++,
        material_name: row.material,
        material_code: row.material_code,
        material_child: row.material_child,
        entity_id: row.id,
        entity_name: row.entity,
        province: row.province,
        regency: row.regency,
        sub_district: row.subdistrict,
        entity_type: t(`entity_type.label.${row.entity_type}`),
        batch_code: row.batch_code,
        expired_date: row.expired_date,
        activity: row.activity,
        disposal_qty: row.disposal_qty,
        disposal_discard_qty: row.disposal_discard_qty,
        disposal_received_qty: row.disposal_received_qty,
        disposal_shipped_qty: row.disposal_shipped_qty,
        transaction_reason: row.transaction_reason,
        budget_source: row.budget_source,
        updated_at: row.updated_at,
      })
    }

    await excelTemplate.addRows(title, rows)

    return await excelTemplate.generate()
  }
}
