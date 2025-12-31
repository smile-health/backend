import { DASHBOARD_TRANSACTION_TYPE } from "@/common/constants/monitoring.js"
import { BadRequestError } from "@smile/lib/error.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import _ from "lodash"
import { default as moment, default as momentTZ } from "moment-timezone"
import { RowType } from "../stock/stock.schema.js"
import { MonitoringTransactionRepository } from "./transaction.repository.js"
import {
  MonitoringTransactionBigNumberDTO,
  MonitoringTransactionChartDTO,
  MonitoringTransactionChartOldDTO,
  MonitoringTransactionDTO,
  MonitoringTransactionSchemaQueryParams,
} from "./transaction.schema.js"
import { generatePeriods } from "@/common/utils/period.js"
import {
  generateMonitoringTransactionSeries,
  processChartData,
} from "./transaction.utils.js"
import { EntityTagRepository } from "@/modules/entity-tag/entity-tag.repository.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"

export class MonitoringTransactionModule {
  constructor(
    private readonly monitoringTransactionRepo: MonitoringTransactionRepository,
    private readonly entityTagRepo: EntityTagRepository,
    private readonly entityRepo: EntityRepository
  ) {}

  async getChart(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams
  ) {
    console.log("QUERY PARAMS", queryParams)
    queryParams.monitoringTransactionType = DASHBOARD_TRANSACTION_TYPE.CHART
    queryParams.transactionQuery!.orderBy =
      `year asc, month asc, ` + queryParams.transactionQuery!.orderBy
    queryParams.transaction_type = undefined

    const monitoringTransaction =
      await this.monitoringTransactionRepo.getMonitoringTransaction(
        c,
        queryParams
      )

    const result: MonitoringTransactionChartDTO = {}

    const serieses = generateMonitoringTransactionSeries(c)
    const categories = generatePeriods(queryParams)

    const { records: entities } = await this.entityRepo.fetchEntities(
      c,
      queryParams,
      {
        is_paginate: false,
        count: false,
      }
    )

    console.log("ENTITY", entities)

    const entityTagIds = entities
      .map((item) => Number(item.entity_tag_id))
      .filter((item) => item)

    const entityTagQueryParam = queryParams.entity_id
      ? { ...queryParams, entity_tag_ids: entityTagIds }
      : queryParams

    const { records: entityTags } = await this.entityTagRepo.fetchEntityTags(
      c,
      entityTagQueryParam,
      {
        is_paginate: false,
        count: false,
      }
    )

    console.log("ENTITY TAG", entityTags)

    const entityTagMapped = entityTags.map((item) => ({
      id: String(item.id),
      label: c.var.t(`entity_tag.label.${item.title}`),
      selector: item.title ?? "",
    }))

    const entityTagDataset = processChartData(
      c,
      monitoringTransaction,
      queryParams,
      serieses,
      entityTagMapped,
      "entity_tag_id"
    )

    const byMonthDataset = processChartData(
      c,
      monitoringTransaction,
      queryParams,
      serieses,
      categories,
      "month"
    )

    result.by_entity_tag = {
      categories: entityTagMapped,
      dataset: entityTagDataset,
    }

    result.by_month = {
      categories: categories,
      dataset: byMonthDataset,
    }

    return {
      date: moment(queryParams.to).format("YYYY-MM-DD"),
      chart: result,
    }
  }

  async getChartOld(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams
  ) {
    queryParams.monitoringTransactionType = DASHBOARD_TRANSACTION_TYPE.CHART_OLD
    queryParams.transactionQuery!.orderBy =
      `year asc, month asc, ` + queryParams.transactionQuery!.orderBy
    const monitoringTransaction =
      await this.monitoringTransactionRepo.getMonitoringTransaction(
        c,
        queryParams
      )

    const result: MonitoringTransactionChartOldDTO = {}
    const entityTotal: Record<string, number> = {}
    const monthTotal: Record<string, number> = {}

    monitoringTransaction.forEach((el) => {
      if (!entityTotal[el.entity_tag_id!]) {
        entityTotal[el.entity_tag_id!] = 0
      }

      entityTotal[el.entity_tag_id!]! +=
        queryParams.information_type === 1 ? (el.count ?? 0) : (el.value ?? 0)

      const monthKey = `${el.year}-${el.month}`
      monthTotal[monthKey] ??= 0
      monthTotal[monthKey] +=
        queryParams.information_type === 1 ? (el.count ?? 0) : (el.value ?? 0)
    })

    if (
      queryParams.transaction_type === 4 ||
      queryParams.transaction_type === 103
    ) {
      result.number = Object.values(entityTotal).reduce(
        (acc: number, val) => acc + (typeof val === "number" ? val : 0),
        0
      )
    } else {
      result.number = Math.max(...Object.values(entityTotal))
    }

    result.entity_tag = Object.entries(entityTotal).map(
      ([entity_tag_id, val]) => {
        const foundEntry = monitoringTransaction.find(
          (entry) => entry.entity_tag_id === Number(entity_tag_id)
        )

        return {
          entity_tag_id: Number(entity_tag_id),
          entity_tag_name:
            c.var.t(`entity_tag.label.${foundEntry?.entity_tag_title}`) ?? null,
          value: val,
        }
      }
    )

    result.by_month = Object.entries(monthTotal).map(([monthKey, val]) => {
      const [year, month] = monthKey.split("-")

      const monthNameT = moment(`${year}-${month}`).format("MMMM")

      return {
        year: Number(year ?? 0),
        month: monthNameT,
        value: val,
      }
    })

    return {
      date: moment(queryParams.to).format("YYYY-MM-DD"),
      chart: result,
    }
  }

  async getBigNumber(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams
  ) {
    queryParams.monitoringTransactionType = DASHBOARD_TRANSACTION_TYPE.CHART_OLD
    queryParams.transactionQuery!.orderBy =
      `year asc, month asc, ` + queryParams.transactionQuery!.orderBy
    const monitoringTransaction =
      await this.monitoringTransactionRepo.getMonitoringTransaction(
        c,
        queryParams
      )

    const entityTotal: Record<string, number> = {}
    const monthTotal: Record<string, number> = {}

    monitoringTransaction.forEach((el) => {
      if (!entityTotal[el.entity_tag_id!]) {
        entityTotal[el.entity_tag_id!] = 0
      }

      entityTotal[el.entity_tag_id!]! +=
        queryParams.information_type === 1 ? (el.count ?? 0) : (el.value ?? 0)

      const monthKey = `${el.year}-${el.month}`
      monthTotal[monthKey] ??= 0
      monthTotal[monthKey] +=
        queryParams.information_type === 1 ? (el.count ?? 0) : (el.value ?? 0)
    })

    let bigNumber: number = 0
    if (
      queryParams.transaction_type === 4 ||
      queryParams.transaction_type === 103
    ) {
      bigNumber = Object.values(entityTotal).reduce(
        (acc: number, val) => acc + (typeof val === "number" ? val : 0),
        0
      )
    } else {
      bigNumber = Math.max(...Object.values(entityTotal))
    }

    return {
      date: moment(queryParams.to).format("YYYY-MM-DD"),
      data: bigNumber,
    } as MonitoringTransactionBigNumberDTO
  }

  async getMaterial(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams
  ) {
    queryParams.monitoringTransactionType = DASHBOARD_TRANSACTION_TYPE.MATERIAL
    if (queryParams.sort_by_id != undefined) {
      const sortBy = queryParams.sort_by_id === 0 ? "ASC" : "DESC"
      queryParams.transactionQuery!.orderBy = `t.dmm_name ${sortBy}`
    }
    const monitoringTransaction =
      await this.monitoringTransactionRepo.getMonitoringTransaction(
        c,
        queryParams
      )

    const result =
      queryParams.material_level_id == 3
        ? this.mapResponseMaterial(
            monitoringTransaction,
            queryParams.information_type
          )
        : this.mapResponseMaterialParent(
            monitoringTransaction,
            queryParams.information_type
          )

    return {
      date: new Date().toISOString(),
      list: result,
    }
  }

  async getTransactionReason(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams
  ) {
    queryParams.monitoringTransactionType =
      DASHBOARD_TRANSACTION_TYPE.TRANSACTION_REASON
    const monitoringTransaction =
      await this.monitoringTransactionRepo.getMonitoringTransaction(
        c,
        queryParams
      )
    const result = this.mapResponseTransactionReason(
      c,
      monitoringTransaction,
      queryParams.information_type
    )

    return {
      date: new Date().toISOString(),
      list: result,
    }
  }

  async getProvince(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams
  ) {
    queryParams.monitoringTransactionType = DASHBOARD_TRANSACTION_TYPE.PROVINCE
    if (queryParams.sort_by_id != undefined) {
      const sortBy = queryParams.sort_by_id === 0 ? "ASC" : "DESC"
      queryParams.transactionQuery!.orderBy = `t.entities_province_id ${sortBy}`
    }
    const monitoringTransaction =
      await this.monitoringTransactionRepo.getMonitoringTransaction(
        c,
        queryParams
      )
    const result = this.mapResponseProvince(
      monitoringTransaction,
      queryParams.information_type
    )

    return {
      date: new Date().toISOString(),
      list: result,
    }
  }

  async getRegency(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams
  ) {
    queryParams.monitoringTransactionType = DASHBOARD_TRANSACTION_TYPE.REGENCY
    if (queryParams.sort_by_id != undefined) {
      const sortBy = queryParams.sort_by_id === 0 ? "ASC" : "DESC"
      queryParams.transactionQuery!.orderBy = `t.entities_regency_id ${sortBy}`
    }
    const monitoringTransaction =
      await this.monitoringTransactionRepo.getMonitoringTransaction(
        c,
        queryParams
      )
    const result = this.mapResponseRegency(
      monitoringTransaction,
      queryParams.information_type
    )

    return {
      date: new Date().toISOString(),
      list: result,
    }
  }

  async getEntity(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams
  ) {
    queryParams.monitoringTransactionType = DASHBOARD_TRANSACTION_TYPE.ENTITY
    if (queryParams.sort_by_id != undefined) {
      const sortBy = queryParams.sort_by_id === 0 ? "ASC" : "DESC"
      queryParams.transactionQuery!.orderBy = `t.entities_id ${sortBy}`
    }
    queryParams.offset = (queryParams.page - 1) * queryParams.paginate

    // Get total count and paginated data in parallel
    const [totalCount, monitoringTransaction] = await Promise.all([
      this.monitoringTransactionRepo.getMonitoringTransactionCount(
        c,
        queryParams
      ),
      this.monitoringTransactionRepo.getMonitoringTransaction(c, queryParams),
    ])

    const result = this.mapResponseEntity(
      monitoringTransaction,
      queryParams.information_type
    )

    return {
      date: new Date().toISOString(),
      ...new PaginatedResponse(
        { page: queryParams.page, paginate: queryParams.paginate },
        result,
        totalCount
      ),
    }
  }

  async getEntityComplete(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams,
    isDownload: boolean = false
  ) {
    queryParams.monitoringTransactionType =
      DASHBOARD_TRANSACTION_TYPE.ENTITY_COMPLETE
    queryParams.transactionQuery!.groupBy =
      "GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28"
    queryParams.transactionQuery!.orderBy = "created_at DESC"
    if (
      queryParams.transactionQuery?.columnJoinTable &&
      queryParams.transactionQuery?.joinTable
    ) {
      queryParams.transactionQuery.groupBy =
        "GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30"
    }
    queryParams.offset = (queryParams.page - 1) * queryParams.paginate

    // For downloads, fetch all data without pagination
    if (isDownload) {
      const monitoringTransaction =
        await this.monitoringTransactionRepo.getMonitoringTransaction(
          c,
          queryParams,
          false // Disable pagination for downloads
        )
      const result = this.mapResponseEntityComplete(
        c,
        monitoringTransaction,
        queryParams.information_type
      )
      return {
        date: new Date().toISOString(),
        list: result,
      }
    }

    // Get total count and paginated data in parallel
    const [totalCount, monitoringTransaction] = await Promise.all([
      this.monitoringTransactionRepo.getMonitoringTransactionCount(
        c,
        queryParams
      ),
      this.monitoringTransactionRepo.getMonitoringTransaction(c, queryParams),
    ])

    const result = this.mapResponseEntityComplete(
      c,
      monitoringTransaction,
      queryParams.information_type
    )

    return {
      date: new Date().toISOString(),
      ...new PaginatedResponse(
        { page: queryParams.page, paginate: queryParams.paginate },
        result,
        totalCount
      ),
    }
  }

  async getExportCsv(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams
  ) {
    const exportData = await this.getEntityComplete(c, queryParams, true)
    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    if (exportData.list?.length! > 1000000) {
      throw new BadRequestError(c.var.t("csv_limit"))
    }

    const rows: RowType[][] = []
    const sheet = c.var.t("dashboard.monitoring_transaction.title")
    const informationTypeLabel =
      queryParams.information_type === 1
        ? c.var.t("common.frequency")
        : c.var.t("common.qty")
    const timeZone = c.req.header("Timezone") ?? "UTC"
    const language = c.var.language
    const formatDate =
      momentTZ().tz(timeZone).format("MM-DD-YYYY HH_mm_ss") +
      " GMT" +
      momentTZ().tz(timeZone).format("Z").replace(":00", "")

    const columns = [
      "No",
      c.var.t("entity.label.province_id"),
      c.var.t("entity.label.province"),
      c.var.t("entity.label.regency_id"),
      c.var.t("entity.label.regency"),
      c.var.t("entity.label.id_entity"),
      c.var.t("entity.label.name"),
      c.var.t("common.material"),
      "Unit",
      c.var.t("stock.sheet.batch_code"),
      c.var.t("order.label.expired_date_batch"),
      c.var.t("manufacture.export.name"),
      c.var.t("order.label.vendor_name"),
      c.var.t("entity.label.customer_province_id"),
      c.var.t("entity.label.customer_province_name"),
      c.var.t("entity.label.customer_regency_id"),
      c.var.t("entity.label.customer_regency_name"),
      c.var.t("order.label.customer_id"),
      c.var.t("order.label.customer_name"),
      c.var.t("common.created_at"),
      c.var.t("transaction.export.transaction_type_title"),
      c.var.t("transaction.export.transaction_reason_title"),
      "qty",
    ]

    const exportRows = Array.isArray(exportData.list)
      ? exportData.list
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((exportData as any).data ?? [])

    exportRows.forEach((el, index: number) => {
      const row = [
        index + 1,
        el.province?.id ?? "",
        `"${el.province.name ?? ""}"`,
        el.regency?.id ?? "",
        `"${el.regency?.name ?? ""}"`,
        el.entity.id,
        `"${el.entity.name}"`,
        `"${el.material.name}"`,
        el.material.unit,
        `"${el.batch?.code ?? ""}"`,
        el.batch?.expDate ?? "",
        `"${el.batch?.manufacture?.name ?? ""}"`,
        `"${el.vendor?.name ?? ""}"`,
        el.customer?.province_id ?? "",
        `"${el.customer?.province_name ?? ""}"`,
        el.customer?.regency_id ?? "",
        `"${el.customer?.regency_name ?? ""}"`,
        el.customer?.id ?? "",
        `"${el.customer?.name ?? ""}"`,
        moment(el.created_at).tz(timeZone).format("YYYY-MM-DD HH:mm:ss"),
        c.var.t(`transaction_type.id.${el.transaction_type.id}`),
        el.transaction_reason.name,
        el.value,
      ]

      rows.push(row as RowType[])
    })

    // el.material.name ? el.material.name.replace(/,\s*/g, "-") : "",

    const filename = `${sheet} - ${queryParams.transactionQuery?.transaction_type_title} - ${informationTypeLabel} ${formatDate}_${language}.csv`
    const csvContent = `${columns.join(",")}\n${rows.map((row) => row.join(",")).join("\n")}`

    return {
      filename: filename,
      buffer: csvContent,
    }
  }

  private mapResponseProvince(
    data: MonitoringTransactionDTO[],
    information_type: MonitoringTransactionSchemaQueryParams["information_type"]
  ) {
    return data.map((el) => {
      return {
        province: {
          id: el.province_id,
          name: el.province_name,
        },
        value: information_type === 1 ? el.count : el.value,
      }
    })
  }

  private mapResponseRegency(
    data: MonitoringTransactionDTO[],
    information_type: MonitoringTransactionSchemaQueryParams["information_type"]
  ) {
    return data.map((el) => {
      return {
        regency: {
          id: el.regency_id,
          name: el.regency_name,
        },
        value: information_type === 1 ? el.count : el.value,
      }
    })
  }

  private mapResponseEntity(
    data: MonitoringTransactionDTO[],
    information_type: MonitoringTransactionSchemaQueryParams["information_type"]
  ) {
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
        value: information_type === 1 ? el.count : el.value,
      }
    })
  }

  private mapResponseEntityComplete(
    c: Context,
    data: MonitoringTransactionDTO[],
    information_type: MonitoringTransactionSchemaQueryParams["information_type"]
  ) {
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
        transaction_type: {
          id: el.transaction_type_id,
          name: c.var.t(`transaction.type.${el.transaction_type_id}`),
        },
        transaction_reason: {
          id: el.transaction_reason_id,
          name: c.var.t(`transaction.reason.${el.transaction_reason_name}`),
        },
        material: {
          id: el.material_id,
          name: el.material_name,
          unit: el.material_unit,
          parent: el.material_parent_name ?? null,
        },
        vendor: el.vendor_id
          ? {
              id: el.vendor_id,
              name: el.vendor_name,
            }
          : null,
        customer: el.customer_id
          ? {
              id: el.customer_id,
              name: el.customer_name,
              province_id: el.customer_province_id,
              province_name: el.customer_province_name,
              regency_id: el.customer_regency_id,
              regency_name: el.customer_regency_name,
            }
          : null,
        batch: {
          id: el.batch_id,
          code: el.batch_code,
          expDate: el.expired_date,
          manufacture: {
            id: el.manufacture_id,
            name: el.manufacture_name,
          },
        },
        value: information_type === 1 ? el.count : el.value,
        created_at: el.created_at,
      }
    })
  }

  private mapResponseMaterial(
    data: MonitoringTransactionDTO[],
    information_type: MonitoringTransactionSchemaQueryParams["information_type"]
  ) {
    return data.map((el) => {
      return {
        material: {
          id: el.material_id,
          name: el.material_name,
          unit: el.material_unit,
        },
        value: information_type === 1 ? el.count : el.value,
      }
    })
  }

  private mapResponseMaterialParent(
    data: MonitoringTransactionDTO[],
    information_type: MonitoringTransactionSchemaQueryParams["information_type"]
  ) {
    const materialLevel92 = _.groupBy(data, "material_parent_id")

    const result: Array<{
      material: { id: string; name: string | null; unit: string | null }
      value: number
    }> = []
    for (const key in materialLevel92) {
      const item = materialLevel92[key]
      if (item && item.length > 0) {
        const total = item.reduce(
          (acc, curr) =>
            acc +
            (information_type === 1
              ? Number(curr.count ?? 0)
              : Number(curr.value ?? 0)),
          0
        )
        result.push({
          material: {
            id: key,
            name: item[0]?.material_parent_name ?? null,
            unit: item[0]?.material_unit ?? null,
          },
          value: total,
        })
      }
    }

    return _.orderBy(result, "value", "desc")
  }

  private mapResponseTransactionReason(
    c: Context,
    data: MonitoringTransactionDTO[],
    information_type: MonitoringTransactionSchemaQueryParams["information_type"]
  ) {
    return data.map((el) => {
      return {
        transaction_reason: {
          id: el.reason_id,
          name: c.var.t(`transaction.reason.${el.reason_name}`),
        },
        value: information_type === 1 ? el.count : el.value,
      }
    })
  }
}
