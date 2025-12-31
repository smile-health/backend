import { Context } from "hono"
import {
  StockOpnameComplianceResponse,
  StockOpnameComplianceResponseData,
  StockOpnameQueryParams,
  StockOpnameResultResponse,
  StockOpnameResultResponseData,
  StockOpnameMaterialResponse,
  StockOpnameMaterialResponseData,
  StockOpnameComplianceSummaryResponse,
  StockOpnameResultSummaryResponse,
  StockOpnameResultDTO,
} from "./stock-opname.schema.js"
import { StockOpnameRepository } from "./stock-opname.repository.js"
import { SUMMARY_BOX_ENTITY_TAGS } from "@/common/constants/stock-opname.js"
import { collect, round } from "@smile/lib/utils.js"
import {
  buildSoComplianceResponseData,
  buildSoResultResponseData,
  buildSoMaterialResponseData,
  getTotalSoSummary,
} from "./stock-opname.utils.js"
import { MaterialRepository } from "../material/material.repository.js"
import { LocationModule } from "../location/location.module.js"
import moment from "moment"
import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository.js"
import { RegionRepository } from "../region/region.repository.js"
import { ActivityRepository } from "../activity/activity.repository.js"
import { ENTITY_TAG, ENTITY_TYPE } from "@/common/constants/entity.js"
import { Filter } from "@smile/lib/excel/types.js"
import { MaterialQueryParams } from "../material/material.schema.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { BaseModule } from "../base.module.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"

export class StockOpnameModule extends BaseModule {
  constructor(
    private readonly stockOpnameRepository: StockOpnameRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly entityRepository: EntityRepository,
    private readonly entityTagRepository: EntityTagRepository,
    private readonly regionRepository: RegionRepository,
    private readonly activityRepository: ActivityRepository,
    private readonly locationModule: LocationModule,
    protected readonly exportHistoryRepo: ExportHistoryRepository,
    protected readonly publisher: Publisher
  ) {
    super(exportHistoryRepo, publisher)
  }

  async stockOpnameComplianceSummary(
    c: Context,
    queryParams: StockOpnameQueryParams
  ): Promise<StockOpnameComplianceSummaryResponse> {
    const soComplianceDataset =
      await this.stockOpnameRepository.fetchSoCompliance(c, queryParams, true)

    const totalSoComplianceDataset =
      await this.stockOpnameRepository.fetchTotalSoCompliance(
        c,
        queryParams,
        true
      )

    const summaries = SUMMARY_BOX_ENTITY_TAGS.map((summaryEntityTag, index) => {
      const soComplianceSummary = soComplianceDataset.find(
        (item) => item.entity_tag_id === summaryEntityTag.id
      )
      const totalSoComplianceSummary = totalSoComplianceDataset.find(
        (item) => item.entity_tag_id === summaryEntityTag.id
      )

      const entityTotal = totalSoComplianceSummary
        ? totalSoComplianceSummary.count
        : 0
      const done = soComplianceSummary ? soComplianceSummary.count : 0
      const notYet = Math.abs(entityTotal - done)
      const donePercentage = entityTotal ? round((done / entityTotal) * 100) : 0
      const notYetPercentage = entityTotal
        ? round((notYet / entityTotal) * 100)
        : 0

      const data = {
        row: index + 1,
        entity_tag: {
          id: summaryEntityTag.id,
          name: c.var.t(`entity_tag.label.${summaryEntityTag.key}`),
        },
        entity_total: entityTotal,
        done,
        not_yet: notYet,
        entity_total_percentage: 100,
        done_percentage: donePercentage,
        not_yet_percentage: notYetPercentage,
      }

      return data
    })

    /* Calculate Count Total */
    const totalEntity = getTotalSoSummary(totalSoComplianceDataset, "count")
    const totalDone = getTotalSoSummary(soComplianceDataset, "count")
    const totalNotYet = Math.abs(totalEntity - totalDone)

    /* Insert totalCountObject to first index */
    const totalCountObject = {
      row: 0,
      entity_tag: {
        id: 0,
        name: c.var.t("common.all"),
      },
      entity_total: totalEntity,
      done: totalDone,
      not_yet: totalNotYet,
      entity_total_percentage: 100,
      done_percentage: totalEntity ? round((totalDone / totalEntity) * 100) : 0,
      not_yet_percentage: totalEntity
        ? round((totalNotYet / totalEntity) * 100)
        : 0,
    }

    summaries.unshift(totalCountObject)

    return {
      date: new Date(),
      data: summaries,
    }
  }

  async stockOpnameCompliance(
    c: Context,
    queryParams: StockOpnameQueryParams,
    download: boolean = false
  ): Promise<StockOpnameComplianceResponse> {
    const {
      province_ids,
      regency_ids,
      entity_ids,
      entity_tag_ids,
      page,
      paginate,
    } = queryParams

    const compliances: StockOpnameComplianceResponseData = []
    let totalResult: number = 0

    // Put parent entity at the first dataset if below conditions are fulfilled
    if (!entity_ids && !entity_tag_ids && page === 1) {
      const parentQueryParams = { ...queryParams }

      const { records: parentLocations, count: totalParent } =
        await this.locationModule.getParentLocations(c, queryParams, download)

      const [parentSoComplianceDataset, parentTotalSoComplianceDataset] =
        await Promise.all([
          this.stockOpnameRepository.fetchSoCompliance(
            c,
            parentQueryParams,
            false
          ),
          this.stockOpnameRepository.fetchTotalSoCompliance(
            c,
            parentQueryParams,
            false
          ),
        ])

      parentLocations.forEach((parentLocation, index) => {
        const parentSoCompliance = parentSoComplianceDataset.find(
          (item) => item.location_id === parentLocation.id
        )
        const parentTotalSoCompliance = parentTotalSoComplianceDataset.find(
          (item) => item.location_id === parentLocation.id
        )

        const data = buildSoComplianceResponseData(
          c,
          parentSoCompliance,
          parentTotalSoCompliance,
          parentLocation,
          index
        )

        compliances.push(data)
      })

      totalResult += totalParent
    }

    if (compliances.length >= paginate) {
      return {
        date: new Date(),
        page: page,
        item_per_page: paginate,
        total_item: totalResult,
        total_page: Math.ceil(totalResult / paginate),
        list_pagination: [10, 25, 50, 100],
        data: compliances,
      }
    }
    queryParams.paginate = paginate - compliances.length

    const { records: locations, count: total } =
      await this.locationModule.getLocations(c, queryParams, download)

    // Optimize filters by fetching stock opaname data by the paginated locations id
    const locationIds = locations.map((location) => location.id)
    if (download) {
      download = true // bypass if download
    } else if (entity_ids || entity_tag_ids || (province_ids && regency_ids)) {
      queryParams.entity_ids = locationIds // locationIds is array of entity ids
    } else if (province_ids && !regency_ids) {
      queryParams.regency_ids = locationIds // locationIds is array of regency ids
    } else {
      queryParams.province_ids = locationIds // locationIds is array of province ids
    }

    const [soComplianceDataset, totalSoComplianceDataset] = await Promise.all([
      this.stockOpnameRepository.fetchSoCompliance(c, queryParams, false),
      this.stockOpnameRepository.fetchTotalSoCompliance(c, queryParams, false),
    ])

    locations.forEach((location, index) => {
      const soCompliance = soComplianceDataset.find(
        (item) => item.location_id === location.id
      )
      const totalSoCompliance = totalSoComplianceDataset.find(
        (item) => item.location_id === location.id
      )

      const data = buildSoComplianceResponseData(
        c,
        soCompliance,
        totalSoCompliance,
        location,
        index
      )

      compliances.push(data)
    })

    totalResult += total

    return {
      date: new Date(),
      page: page,
      item_per_page: paginate,
      total_item: totalResult,
      total_page: Math.ceil(totalResult / paginate),
      list_pagination: [10, 25, 50, 100],
      data: compliances,
    }
  }

  async stockOpnameComplianceExport(
    c: Context,
    queryParams: StockOpnameQueryParams
  ) {
    queryParams.program_id = c.var.programId

    return await this.handleAsyncExport(
      c,
      TOPIC.DASHBOARD_STOCK_OPNAME_COMPLIANCE_EXPORTED,
      {
        filename: c.var.t("stock_opname.sheet.title.compliance"),
        params: queryParams,
      }
    )
  }

  async stockOpnameResultSummary(
    c: Context,
    queryParams: StockOpnameQueryParams
  ): Promise<StockOpnameResultSummaryResponse> {
    const soResultDataset = (await this.stockOpnameRepository.fetchSoResult(
      c,
      queryParams,
      true
    )) as StockOpnameResultDTO

    const summaries = SUMMARY_BOX_ENTITY_TAGS.map((summaryEntityTag, index) => {
      const resultSoSummary = soResultDataset.find(
        (item) => item.entity_tag_id === summaryEntityTag.id
      )

      return {
        row: index + 1,
        entity_tag: {
          id: summaryEntityTag.id,
          name: c.var.t(`entity_tag.label.${summaryEntityTag.key}`),
        },
        stock: resultSoSummary ? resultSoSummary.stock : 0,
        exp_stock: resultSoSummary ? resultSoSummary.exp_stock : 0,
        stock_in_transit: resultSoSummary
          ? resultSoSummary.stock_in_transit
          : 0,
        real_stock: resultSoSummary ? resultSoSummary.real_stock : 0,
        difference: resultSoSummary ? resultSoSummary.difference : 0,
        difference_percentage: round(
          resultSoSummary ? resultSoSummary.difference_percentage : 0
        ),
      }
    })

    /* Calculate Sum Total */
    const totalStock = getTotalSoSummary(soResultDataset, "stock")
    const totalExpStock = getTotalSoSummary(soResultDataset, "exp_stock")
    const totalStockInTransit = getTotalSoSummary(
      soResultDataset,
      "stock_in_transit"
    )
    const totalRealStock = getTotalSoSummary(soResultDataset, "real_stock")
    const difference = Math.abs(totalStock - totalRealStock)

    /* Insert totalSumObject to first index */
    const totalSumObject = {
      row: 0,
      entity_tag: {
        id: 0,
        name: c.var.t("common.all"),
      },
      stock: totalStock,
      exp_stock: totalExpStock,
      stock_in_transit: totalStockInTransit,
      real_stock: totalRealStock,
      difference: difference,
      difference_percentage: round((difference / totalStock) * 100),
    }

    summaries.unshift(totalSumObject)

    return {
      date: new Date(),
      data: summaries,
    }
  }

  async stockOpnameResult(
    c: Context,
    queryParams: StockOpnameQueryParams,
    download: boolean = false
  ): Promise<StockOpnameResultResponse> {
    const {
      province_ids,
      regency_ids,
      entity_ids,
      entity_tag_ids,
      page,
      paginate,
    } = queryParams

    const results: StockOpnameResultResponseData = []
    let totalResult: number = 0

    // Put parent entity at the first dataset if below conditions are fulfilled
    if (!entity_ids && !entity_tag_ids && page === 1) {
      const parentQueryParams = { ...queryParams }

      if (province_ids && regency_ids) {
        parentQueryParams.entity_type_id = ENTITY_TYPE.REGENCY
        parentQueryParams.entity_tag_ids = [
          ENTITY_TAG.CITY_DISTRICT_HEALTH_OFFICE,
        ]
      } else if (province_ids && !regency_ids) {
        parentQueryParams.entity_type_id = ENTITY_TYPE.PROVINCE
        parentQueryParams.entity_tag_ids = [ENTITY_TAG.PROVINCE_HEALTH_OFFICE]
      } else {
        parentQueryParams.entity_type_id = ENTITY_TYPE.CENTER
        parentQueryParams.entity_tag_ids = [ENTITY_TAG.MAIN_SUPPLIER]
      }

      const [parentSoResultDataset, parentSoResultTotal] = await Promise.all([
        this.stockOpnameRepository.fetchSoResult(c, parentQueryParams, false, {
          is_paginate: !download,
          count: false,
        }) as Promise<StockOpnameResultDTO>,
        this.stockOpnameRepository.fetchSoResult(c, parentQueryParams, false, {
          is_paginate: false,
          count: true,
        }) as Promise<number>,
      ])

      if (parentSoResultDataset && parentSoResultDataset.length > 0) {
        parentSoResultDataset.forEach((parentSoCompliance, index) => {
          const data = buildSoResultResponseData(c, parentSoCompliance, index)

          results.push(data)
        })
      }

      totalResult += parentSoResultTotal
    }

    const [soResultDataset, soResultTotal] = await Promise.all([
      this.stockOpnameRepository.fetchSoResult(c, queryParams, false, {
        is_paginate: !download,
        count: false,
      }) as Promise<StockOpnameResultDTO>,
      this.stockOpnameRepository.fetchSoResult(c, queryParams, false, {
        is_paginate: false,
        count: true,
      }) as Promise<number>,
    ])

    if (soResultDataset && soResultDataset.length > 0) {
      soResultDataset.forEach((soCompliance, index) => {
        const data = buildSoResultResponseData(c, soCompliance, index)

        results.push(data)
      })
    }

    totalResult += soResultTotal

    return {
      date: new Date(),
      page: page,
      item_per_page: paginate,
      total_item: totalResult,
      total_page: Math.ceil(totalResult / paginate),
      list_pagination: [10, 25, 50, 100],
      data: results,
    }
  }

  async stockOpnameResultExport(
    c: Context,
    queryParams: StockOpnameQueryParams
  ) {
    queryParams.program_id = c.var.programId

    return await this.handleAsyncExport(
      c,
      TOPIC.DASHBOARD_STOCK_OPNAME_RESULT_EXPORTED,
      {
        filename: c.var.t("stock_opname.sheet.title.result"),
        params: queryParams,
      }
    )
  }

  async stockOpnameMaterial(
    c: Context,
    queryParams: StockOpnameQueryParams,
    download: boolean = false
  ): Promise<StockOpnameMaterialResponse> {
    const {
      province_ids,
      regency_ids,
      entity_ids,
      entity_tag_ids,
      page,
      paginate,
      material_ids,
    } = queryParams

    const results: StockOpnameMaterialResponseData = []
    let totalResult: number = 0

    const mateiralQueryParams: MaterialQueryParams = {
      ...queryParams,
    }
    const materialResult = await this.materialRepository.fetchMaterials(
      c,
      mateiralQueryParams,
      { is_paginate: false }
    )
    const materials = materialResult.records

    const paramMasterMaterialIds =
      material_ids || materials.map((item) => item.id)

    // Put parent entity at the first dataset if below conditions are fulfilled
    if (!entity_ids && !entity_tag_ids && page === 1) {
      const parentQueryParams = { ...queryParams }

      const { records: parentLocations, count: totalParent } =
        await this.locationModule.getParentLocations(
          c,
          parentQueryParams,
          download
        )

      const stockOpnameDataFirst =
        await this.stockOpnameRepository.fetchSoMaterial(c, {
          ...parentQueryParams,
          material_ids: paramMasterMaterialIds,
        })

      const stockOpnameDataMap = stockOpnameDataFirst.reduce((acc, item) => {
        if (!acc[item.location_id]) {
          acc[item.location_id] = {}
        }
        acc[item.location_id][item.material_id] = item
        return acc
      }, {})

      const parentSoMaterialDenoms =
        await this.materialRepository.fetchSoDenomMaterials(c, {
          ...queryParams,
          entity_ids: collect(parentLocations, "id"),
        })

      parentLocations.forEach((parentLocation, index) => {
        const parentSoMaterialDenom = parentSoMaterialDenoms.find(
          (item) => item.entity_id === parentLocation.id
        )

        const data = buildSoMaterialResponseData(
          c,
          stockOpnameDataMap[parentLocation.id] || {},
          materials,
          parentSoMaterialDenom,
          parentLocation,
          index
        )
        results.push(data)
      })

      totalResult += totalParent
    }

    const { records: locations, count: total } =
      await this.locationModule.getLocations(c, queryParams, download)

    // Optimize filters by fetching stock opaname data by the paginated locations id
    const locationIds = locations.map((location) => location.id)
    if (download) {
      download = true // bypass if download
    } else if (entity_ids || entity_tag_ids || (province_ids && regency_ids)) {
      queryParams.entity_ids = locationIds // locationIds is array of entity ids
    } else if (province_ids && !regency_ids) {
      queryParams.regency_ids = locationIds // locationIds is array of regency ids
    } else {
      queryParams.province_ids = locationIds // locationIds is array of province ids
    }

    const stockOpnameData = await this.stockOpnameRepository.fetchSoMaterial(
      c,
      {
        ...queryParams,
        material_ids: paramMasterMaterialIds,
      }
    )

    const stockOpnameDataMap = stockOpnameData.reduce((acc, item) => {
      if (!acc[item.location_id]) {
        acc[item.location_id] = {}
      }
      acc[item.location_id][item.material_id] = item
      return acc
    }, {})

    const soMaterialDenoms =
      await this.materialRepository.fetchSoDenomMaterials(c, {
        ...queryParams,
        entity_ids: collect(locations, "id"),
      })

    locations.forEach((location, index) => {
      const soMaterialDenom = soMaterialDenoms.find(
        (item) => item.entity_id === location.id
      )

      const data = buildSoMaterialResponseData(
        c,
        stockOpnameDataMap[location.id] || {},
        materials,
        soMaterialDenom,
        location,
        index
      )
      results.push(data)
    })

    totalResult += total

    return {
      date: new Date(),
      page: page,
      item_per_page: paginate,
      total_item: totalResult,
      total_page: Math.ceil(totalResult / paginate),
      list_pagination: [10, 25, 50, 100],
      data: results,
      materials: materials.map((m) => ({
        id: m.id,
        name: m.name,
        is_stock_opname_mandatory: m.is_stock_opname_mandatory,
      })),
    }
  }

  async stockOpnameMaterialExport(
    c: Context,
    queryParams: StockOpnameQueryParams
  ) {
    queryParams.program_id = c.var.programId

    return await this.handleAsyncExport(
      c,
      TOPIC.DASHBOARD_STOCK_OPNAME_MATERIAL_EXPORTED,
      {
        filename: c.var.t("stock_opname.sheet.title.material"),
        params: queryParams,
      }
    )
  }

  async generateFilters(c: Context, queryParams: StockOpnameQueryParams) {
    const {
      activity_ids,
      province_ids,
      regency_ids,
      entity_ids,
      entity_tag_ids,
      material_ids,
    } = queryParams

    const startDate = moment(queryParams.from).format("DD MMMM YYYY")
    const endDate = moment(queryParams.to).format("DD MMMM YYYY")

    const filterPaginationOption: PaginationOption = {
      is_paginate: false,
    }
    const activities = activity_ids
      ? (
          await this.activityRepository.fetchActivities(
            c,
            queryParams,
            filterPaginationOption
          )
        ).records
      : []
    const entities = entity_ids
      ? (
          await this.entityRepository.fetchEntities(
            c,
            queryParams,
            filterPaginationOption
          )
        ).records
      : []
    const entityTags = entity_tag_ids
      ? (
          await this.entityTagRepository.fetchEntityTags(
            c,
            queryParams,
            filterPaginationOption
          )
        ).records
      : []
    const provinces = province_ids
      ? (
          await this.regionRepository.fetchProvinces(
            c,
            queryParams,
            filterPaginationOption
          )
        ).records
      : []
    const regencies = regency_ids
      ? (
          await this.regionRepository.fetchRegencies(
            c,
            queryParams,
            filterPaginationOption
          )
        ).records
      : []
    const materials = material_ids
      ? (
          await this.materialRepository.fetchMaterials(
            c,
            { ...queryParams, material_is_stock_opname_mandatory: 0 },
            filterPaginationOption
          )
        ).records
      : []

    const filters: Filter[] = [
      {
        key: c.var.t("common.from_date"),
        value: startDate,
      },
      {
        key: c.var.t("common.to_date"),
        value: endDate,
      },
      {
        key: c.var.t("common.activity"),
        value:
          Array.isArray(activities) && activities.length > 0
            ? activities.map((activity) => activity.name).join(", ")
            : c.var.t("common.all"),
      },
      {
        key: c.var.t("common.province"),
        value:
          Array.isArray(provinces) && provinces.length > 0
            ? provinces.map((province) => province.name).join(", ")
            : c.var.t("common.all"),
      },
      {
        key: c.var.t("common.regency"),
        value:
          Array.isArray(regencies) && regencies.length > 0
            ? regencies.map((regency) => regency.name).join(", ")
            : c.var.t("common.all"),
      },
      {
        key: c.var.t("common.entity"),
        value:
          Array.isArray(entities) && entities.length > 0
            ? entities.map((entity) => entity.name).join(", ")
            : c.var.t("common.all"),
      },
      {
        key: c.var.t("common.entity_tag"),
        value:
          Array.isArray(entityTags) && entityTags.length > 0
            ? entityTags
                .map((tag) => c.var.t(`entity_tag.label.${tag.title}`))
                .join(", ")
            : c.var.t("common.all"),
      },
      {
        key: c.var.t("common.material"),
        value:
          Array.isArray(materials) && materials.length > 0
            ? materials.map((tag) => tag.name).join(", ")
            : c.var.t("common.all"),
      },
    ]

    return filters
  }
}
