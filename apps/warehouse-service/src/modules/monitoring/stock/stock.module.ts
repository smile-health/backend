import { KFA_LEVEL_CODE } from "@/common/constants/material.js"
import {
  DASHBOARD_STOCK_INFORMATION_TYPE,
  DASHBOARD_STOCK_TYPE,
} from "@/common/constants/monitoring.js"
import {
  generateMonthYearSequence,
  sliceZeroValueMonths,
} from "@/common/utils/common.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { groupBy, orderBy, sumBy } from "es-toolkit"
import { Context } from "hono"
import _ from "lodash"
import moment from "moment"
import momentTZ from "moment-timezone"
import { MonitoringStockRepository } from "./stock.repository.js"
import {
  MonitoringStockDTO,
  MonitoringStockSchemaQueryParams,
  RowType,
} from "./stock.schema.js"

export class MonitoringStockModule {
  constructor(
    private readonly monitoringStockRepo: MonitoringStockRepository
  ) {}

  async getChart(c: Context, queryParams: MonitoringStockSchemaQueryParams) {
    queryParams.monitoringStockType = DASHBOARD_STOCK_TYPE.CHART

    const monitoringStock = await this.monitoringStockRepo.getMonitoringStock(
      c,
      queryParams
    )

    const bigNumber = sumBy(monitoringStock, (el) => el.qty!)

    const groupEntityTags = groupBy(
      monitoringStock,
      (el) => `${el.entity_tag_id}-${el.entity_tag_title}`
    )
    const byEntityTags = _.map(groupEntityTags, (items, key) => {
      const [entityTagId, entityTagName] = key.split("-")
      const totalQty = sumBy(items, (el) => el.qty!)
      return {
        entity_tag_id: parseInt(entityTagId!),
        entity_tag_name: c.var.t(`entity_tag.label.${entityTagName}`),
        value: totalQty,
      }
    })

    const groupedByMaterials = groupBy(
      monitoringStock,
      (item) =>
        `${item["master_materials_id"]}_${item["master_materials_name"]}`
    )
    const byMaterials = _.map(groupedByMaterials, (items, key) => {
      const [materialId, materialName] = key.split("_")
      const totalQty = sumBy(items, (el) => el.qty!)
      return {
        material_id: parseInt(materialId!),
        material_name: materialName,
        value: totalQty,
      }
    })

    const groupedByMonths = groupBy(
      monitoringStock,
      (item) => `${item["year"]}_${item["month"]}`
    )
    const byMonths = _.map(groupedByMonths, (items, key) => {
      const [year, month] = key.split("_")
      const totalQty = sumBy(items, (el) => el.qty!)
      return {
        year: year,
        month: month,
        value: totalQty,
      }
    })

    const monthYearSequence = generateMonthYearSequence(
      queryParams.from,
      queryParams.to
    )

    const byMonthsComplete = monthYearSequence.map((monthYear) => {
      const [year, month] = monthYear.split("-")

      const data = byMonths.find((item) => {
        return item.month === month && item.year === year
      })

      const monthNameT = moment(`${year}-${month}`).format("MMMM")

      return {
        year: year,
        month: monthNameT,
        value: data?.value ?? 0,
      }
    })

    let byExpMonthsComplete: {
      exp_year: string | undefined
      exp_month: string
      value: number
    }[] = []
    if (
      queryParams.information_type ===
      DASHBOARD_STOCK_INFORMATION_TYPE.STOCK_ON_HAND
    ) {
      const groupByExpMonths = groupBy(
        monitoringStock,
        (item) => `${item["exp_year"]}_${item["exp_month"]}`
      )

      const byExpMonths = _.map(groupByExpMonths, (items, key) => {
        const [exp_year, exp_month] = key.split("_")
        const totalQty = sumBy(items, (el) => el.qty!)
        return {
          exp_year: exp_year,
          exp_month: exp_month,
          value: totalQty,
        }
      })

      if (!queryParams.start_expired_date && !queryParams.end_expired_date) {
        const { expired_date } =
          await this.monitoringStockRepo.getFurtherBatchExpiredDate()

        queryParams.start_expired_date = moment("2021-01-01").format(
          "YYYY-MM-DD HH:mm:ss"
        ) // 2021-01-01 is constant
        queryParams.end_expired_date = moment(expired_date).format(
          "YYYY-MM-DD HH:mm:ss"
        )
      }

      const expMonthYearSequence = generateMonthYearSequence(
        queryParams.start_expired_date!,
        queryParams.end_expired_date!
      )

      byExpMonthsComplete = expMonthYearSequence.map((monthYear) => {
        const [year, month] = monthYear.split("-")

        const data = byExpMonths.find((item) => {
          return item.exp_month === month && item.exp_year === year
        })

        const monthNameT = moment(`${year}-${month}`).format("MMMM")

        return {
          exp_year: year,
          exp_month: monthNameT,
          value: data?.value ?? 0,
        }
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chart: any = {
      number: bigNumber,
      entity_tag: orderBy(byEntityTags, ["value"], ["desc"]),
      material: orderBy(byMaterials, ["value"], ["desc"]),
      by_month: sliceZeroValueMonths(
        byMonthsComplete,
        (el) => (el as { value: number }).value != 0
      ),
    }

    if (
      queryParams.information_type ===
      DASHBOARD_STOCK_INFORMATION_TYPE.STOCK_ON_HAND
    ) {
      chart.byExpMonth = sliceZeroValueMonths(
        byExpMonthsComplete,
        (item) => (item as { value: number }).value !== 0
      )
    }

    return {
      date: moment(queryParams.to).format("YYYY-MM-DD"),
      chart,
    }
  }

  async getProvince(c: Context, queryParams: MonitoringStockSchemaQueryParams) {
    queryParams.monitoringStockType = DASHBOARD_STOCK_TYPE.PROVINCE
    queryParams.kfaMaterial!.orderBy = `ORDER BY qty DESC`
    if (queryParams.sort_by_id != undefined) {
      const sortBy = queryParams.sort_by_id === 1 ? "DESC" : "ASC"
      const sortByColumn =
        queryParams.information_type ===
        DASHBOARD_STOCK_INFORMATION_TYPE.STOCK_ON_HAND
          ? `entities_province_id`
          : `lp.id`
      queryParams.kfaMaterial!.orderBy = `ORDER BY ${sortByColumn} ${sortBy}`
    }

    const monitoringStock = await this.monitoringStockRepo.getMonitoringStock(
      c,
      queryParams
    )
    const result = this.mapResponseProvince(monitoringStock)

    return {
      date: moment(queryParams.to).format("YYYY-MM-DD"),
      list: result,
    }
  }

  async getRegency(c: Context, queryParams: MonitoringStockSchemaQueryParams) {
    queryParams.monitoringStockType = DASHBOARD_STOCK_TYPE.REGENCY
    queryParams.kfaMaterial!.orderBy = `ORDER BY qty DESC`
    if (queryParams.sort_by_id != undefined) {
      const sortBy = queryParams.sort_by_id === 1 ? "DESC" : "ASC"
      const sortByColumn =
        queryParams.information_type ===
        DASHBOARD_STOCK_INFORMATION_TYPE.STOCK_ON_HAND
          ? `entities_regency_id`
          : `lr.id`
      queryParams.kfaMaterial!.orderBy = `ORDER BY ${sortByColumn} ${sortBy}`
    }

    const monitoringStock = await this.monitoringStockRepo.getMonitoringStock(
      c,
      queryParams
    )
    const result = this.mapResponseRegency(monitoringStock)

    return {
      date: moment(queryParams.to).format("YYYY-MM-DD"),
      list: result,
    }
  }

  async getEntity(c: Context, queryParams: MonitoringStockSchemaQueryParams) {
    queryParams.monitoringStockType = DASHBOARD_STOCK_TYPE.ENTITY
    queryParams.offset = (queryParams.page - 1) * queryParams.paginate
    queryParams.kfaMaterial!.orderBy = `ORDER BY qty DESC`
    if (queryParams.sort_by_id != undefined) {
      const sortBy = queryParams.sort_by_id === 1 ? "DESC" : "ASC"
      const sortByColumn =
        queryParams.information_type ===
        DASHBOARD_STOCK_INFORMATION_TYPE.STOCK_ON_HAND
          ? `entities_id`
          : `transactions_customer_id`
      queryParams.kfaMaterial!.orderBy = `ORDER BY ${sortByColumn} ${sortBy}`
    }

    const monitoringStock = await this.monitoringStockRepo.getMonitoringStock(
      c,
      queryParams
    )
    const result = this.mapResponseEntity(monitoringStock)

    return {
      date: moment(queryParams.to).format("YYYY-MM-DD"),
      ...new PaginatedResponse(
        { page: queryParams.page, paginate: queryParams.paginate },
        result.slice(
          queryParams.offset,
          queryParams.offset + queryParams.paginate
        ),
        result.length
      ),
    }
  }

  async getEntityStock(
    c: Context,
    queryParams: MonitoringStockSchemaQueryParams,
    isDownload: boolean = false
  ) {
    queryParams.monitoringStockType = DASHBOARD_STOCK_TYPE.ENTITY_STOCK
    queryParams.offset = (queryParams.page - 1) * queryParams.paginate
    queryParams.kfaMaterial!.orderBy = `ORDER BY qty DESC`

    const monitoringStock = (
      await this.monitoringStockRepo.getMonitoringStock(c, queryParams)
    ).filter((el) => el.qty != 0)

    const kfaLevelName = this.kfaLevelName(c, queryParams)
    const result = this.mapResponseEntityStock(c, monitoringStock, kfaLevelName)

    if (isDownload) {
      return {
        result,
        kfaLevelName,
      }
    }

    return {
      date: moment(queryParams.to).format("YYYY-MM-DD"),
      ...new PaginatedResponse(
        { page: queryParams.page, paginate: queryParams.paginate },
        result.slice(
          queryParams.offset,
          queryParams.offset + queryParams.paginate
        ),
        result.length
      ),
    }
  }

  async getMaterialEntity(
    c: Context,
    queryParams: MonitoringStockSchemaQueryParams
  ) {
    queryParams.monitoringStockType = DASHBOARD_STOCK_TYPE.ENTITY_MATERIAL
    queryParams.offset = (queryParams.page - 1) * queryParams.paginate
    queryParams.kfaMaterial!.orderBy = `ORDER BY qty DESC`
    if (queryParams.sort_by_id != undefined) {
      const sortBy = queryParams.sort_by_id === 1 ? "DESC" : "ASC"
      const sortByColumn =
        queryParams.information_type ===
        DASHBOARD_STOCK_INFORMATION_TYPE.STOCK_ON_HAND
          ? `entities_id`
          : `transactions_customer_id`
      queryParams.kfaMaterial!.orderBy = `ORDER BY ${sortByColumn} ${sortBy}`
    }

    const monitoringStock = (
      await this.monitoringStockRepo.getMonitoringStock(c, queryParams)
    ).filter((el) => el.qty! > 0)
    const result = this.mapResponseEntityMaterial(monitoringStock)

    return {
      date: queryParams.to,
      ...new PaginatedResponse(
        { page: queryParams.page, paginate: queryParams.paginate },
        result.slice(
          queryParams.offset,
          queryParams.offset + queryParams.paginate
        ),
        result.length
      ),
    }
  }

  async getExportCsv(
    c: Context,
    queryParams: MonitoringStockSchemaQueryParams
  ) {
    const { result: exportData, kfaLevelName } = await this.getEntityStock(
      c,
      queryParams,
      true
    )
    const rows: RowType[][] = []
    const timeZone = c.req.header("Timezone") ?? "UTC"
    const language = c.req.header("Accept-Language") ?? "en"
    const informationTypeLabel =
      queryParams.information_type ===
      DASHBOARD_STOCK_INFORMATION_TYPE.STOCK_ON_HAND
        ? c.var.t("dashboard.monitoring_stock.columns_value.stock_on_hand")
        : c.var.t("dashboard.monitoring_stock.columns_value.stock_in_transit")
    const columns = [
      "No",
      c.var.t("entity.label.province"),
      c.var.t("entity.label.regency"),
      c.var.t("entity.label.id_entity"),
      c.var.t("entity.label.name"),
      c.var.t("entity.label.entity_tag"),
      c.var.t("common.activity"),
      c.var.t("common.material"),
      c.var.t("stock.sheet.batch_code"),
      c.var.t("order.label.expired_date_batch"),
      informationTypeLabel,
    ]
    if (queryParams.material_level_id != undefined) {
      columns.splice(7, 0, c.var.t("common.kfa_level"))
    }

    const exportRows = Array.isArray(exportData)
      ? exportData
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((exportData as any).data ?? [])

    exportRows.forEach((el, index: number) => {
      const row = [
        index + 1,
        `"${el.province?.name ?? ""}"`,
        `"${el.regency?.name ?? ""}"`,
        el.entity.id,
        `"${el.entity.name}"`,
        `"${el.entityTag.name}"`,
        `"${el.activity.name}"`,
        `"${el.material.name}"`,
        `"${el.batches?.code ?? ""}"`,
        el.batches.date ? moment(el.batches.date).format("YYYY-MM-DD") : "",
        el.value,
      ]
      if (queryParams.material_level_id != undefined) {
        row.splice(7, 0, el.kfaLevel.label)
      }
      rows.push(row as RowType[])
    })

    const sheet = c.var.t("dashboard.monitoring_stock.title")
    const formatDate =
      momentTZ().tz(timeZone).format("MM-DD-YYYY HH_mm_ss") +
      " GMT" +
      momentTZ().tz(timeZone).format("Z").replace(":00", "")
    const filename = `${sheet} ${kfaLevelName} - ${informationTypeLabel} - ${formatDate}_${language}`
    const csvContent = `${columns.join(",")}\n${rows.map((row) => row.join(",")).join("\n")}`

    return {
      buffer: csvContent,
      filename,
    }
  }

  private kfaLevelName(
    c: Context,
    queryParams: MonitoringStockSchemaQueryParams
  ) {
    let kfaLevelName: string = ""
    if (
      queryParams.material_level_id &&
      queryParams.material_level_id === KFA_LEVEL_CODE.TEMPLATE
    ) {
      kfaLevelName = c.var.t(`material_level.label.template`)
    } else {
      kfaLevelName = c.var.t(`material_level.label.variant`)
    }
    return kfaLevelName
  }

  private mapResponseProvince(data: MonitoringStockDTO[]) {
    return data.map((el) => {
      return {
        province: {
          id: el.province_id,
          name: el.province_name,
        },
        value: el.qty,
      }
    })
  }

  private mapResponseRegency(data: MonitoringStockDTO[]) {
    return data.map((el) => {
      return {
        regency: {
          id: el.regency_id,
          name: el.regency_name,
        },
        value: el.qty,
      }
    })
  }

  private mapResponseEntity(data: MonitoringStockDTO[]) {
    return data.map((el) => {
      return {
        entity: {
          id: el.entity_id,
          name: el.entity_name,
        },
        province: {
          id: el.province_id,
          name: el.province_name,
        },
        regency: {
          id: el.regency_id,
          name: el.regency_name,
        },
        value: el.qty,
      }
    })
  }

  private mapResponseEntityStock(
    c: Context,
    data: MonitoringStockDTO[],
    kfaLevelName: string
  ) {
    return data.map((el) => {
      return {
        entity: {
          id: el.entity_id,
          name: el.entity_name,
          id_satu_sehat: el.id_satu_sehat,
        },
        province: {
          id: el.province_id,
          name: el.province_name,
        },
        regency: {
          id: el.regency_id,
          name: el.regency_name,
        },
        entityTag: {
          id: el.entity_tag_id,
          name: c.var.t(`entity_tag.label.${el.entity_tag_title}`),
        },
        activity: {
          id: el.activity_id,
          name: el.activity_name,
        },
        material: {
          id: el.master_materials_id,
          name: el.master_materials_name,
          code: el.master_materials_code,
          kfa_code: el.master_materials_kfa_code,
        },
        batches: {
          code: el.batches_code,
          date: el.expired_date,
        },
        kfaLevel: {
          label: kfaLevelName,
        },
        value: el.qty,
      }
    })
  }

  private mapResponseEntityMaterial(data: MonitoringStockDTO[]) {
    let row = 0
    return data.map((el) => {
      row += 1
      return {
        row,
        unit: el.master_materials_unit,
        province: {
          id: el.province_id,
          name: el.province_name,
        },
        regency: {
          id: el.regency_id,
          name: el.regency_name,
        },
        entity: {
          id: el.entity_id,
          name: el.entity_name,
        },
        material: {
          id: el.master_materials_id,
          name: el.master_materials_name,
          unti: el.master_materials_unit,
        },
        total_stock_available: el.qty,
        stock_min: el.min,
        stock_max: el.max,
      }
    })
  }
}
