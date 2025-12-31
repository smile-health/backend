import { Context } from "hono"
import moment from "moment"
import {
  SmileVsAsikQueryParams,
  ReviewResponse,
  TableResponse,
} from "./smile-vs-asik.schema.js"
import { SmileVsAsikRepository } from "./smile-vs-asik.repository.js"
import { LocationModule } from "../location/location.module.js"
import { calculatePercentage } from "./smile-vs-asik.utils.js"
import { calculatePagination } from "@/common/utils/pagination.js"
import { SmileVsAsikExcel } from "./smile-vs-asik.excel.js"
import { round } from "@smile/lib/utils.js"

export class SmileVsAsikModule {
  constructor(
    private readonly smileVsAsikRepository: SmileVsAsikRepository,
    private readonly locationModule: LocationModule,
    private readonly smileVsAsikExcel: SmileVsAsikExcel
  ) {}

  async getReview(
    c: Context,
    queryParams: SmileVsAsikQueryParams
  ): Promise<ReviewResponse> {
    const smileData = await this.smileVsAsikRepository.fetchSmileData(
      c,
      queryParams
    )
    const asikData = await this.smileVsAsikRepository.fetchAsikData(
      c,
      queryParams
    )

    const lastUpdatedResult =
      await this.smileVsAsikRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_update || moment().format("YYYY-MM-DD")

    const data = smileData.map((smileItem) => {
      const locationId = smileItem.location_id || 0
      const asikItem = asikData.find((item) => item.location_id === locationId)
      const totalPcare = asikItem?.pcare_qty || 0
      const smileQty = smileItem.smile_qty || 0
      const percentage = parseFloat(
        calculatePercentage(totalPcare, smileQty, false)
      )

      return {
        id: locationId,
        label: smileItem.location_name || "",
        value: isNaN(percentage) ? 0 : percentage,
        color: "#008ABD",
        tooltip: `${smileItem.location_name}: ${calculatePercentage(totalPcare, smileQty)} (SMILE ${smileQty}, ASIK ${totalPcare})`,
      }
    })

    return {
      last_updated: lastUpdated,
      data,
    }
  }

  async getTable(
    c: Context,
    queryParams: SmileVsAsikQueryParams
  ): Promise<TableResponse> {
    const smileData = await this.smileVsAsikRepository.fetchSmileData(
      c,
      queryParams
    )
    const asikData = await this.smileVsAsikRepository.fetchAsikData(
      c,
      queryParams
    )

    const lastUpdatedResult =
      await this.smileVsAsikRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_update || moment().format("YYYY-MM-DD")

    const locationQueryParams = {
      ...queryParams,
    }

    // Ignore entity_tag_ids for location query if its not filtered by entity_id or (province_id and regency_id) since smile vs asik query also ignore entity_tag_ids for its locaction grouping
    if (
      queryParams.entity_id ||
      (queryParams.province_id && queryParams.regency_id)
    ) {
      locationQueryParams.entity_tag_ids = queryParams.entity_tag_ids
    } else {
      locationQueryParams.entity_tag_ids = undefined
    }

    // Get locations using LocationModule's getLocations method
    const { records: locations, count: total } =
      await this.locationModule.getLocations(c, locationQueryParams)

    // Map smile and asik data with locations
    const paginatedData = locations.map((location) => {
      const locationId = location.id || 0
      const smileItem = smileData.find(
        (item) => item.location_id === locationId
      )
      const asikItem = asikData.find((item) => item.location_id === locationId)

      const totalPcare = asikItem?.pcare_qty || 0
      const smileQty = smileItem?.smile_qty || 0
      const vial = smileItem?.vial || 0
      const consumption_unit_per_distribution_unit =
        smileItem?.consumption_unit_per_distribution_unit || 0

      return {
        id: locationId,
        label: location.name || "",
        total_consumed: smileQty,
        total_pcare: totalPcare,
        percentage: calculatePercentage(totalPcare, smileQty),
        vial,
        consumption_unit_per_distribution_unit,
        usage_index: round(totalPcare / vial),
        target_qty: "-",
        scope: "-",
      }
    })

    const page = queryParams.page || 1
    const paginate = queryParams.paginate || 10

    return {
      last_updated: lastUpdated,
      data: paginatedData,
      ...calculatePagination(total, page, paginate),
    }
  }

  async getExport(c: Context, queryParams: SmileVsAsikQueryParams) {
    const tableData = await this.getTable(c, {
      ...queryParams,
      page: 1,
      paginate: 999999,
    })

    return await this.smileVsAsikExcel.generateTableExport(
      c,
      queryParams,
      tableData
    )
  }
}
