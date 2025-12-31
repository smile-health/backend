import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { LOCATION_LEVEL } from "@/common/constants/location.js"
import { AssetInventoryQueryParams } from "./asset-inventory.schema.js"

export class AssetInventoryQuery {
  constructor() {}

  /**
   * Generate filters for asset ownership queries
   */
  #generateFilters(queryParams: AssetInventoryQueryParams) {
    let filter = ""
    let rtmdFilter = ""

    filter += queryParams.entity_type_ids
      ? " AND da.entity_type_id IN {entity_type_ids:Array(Int64)}"
      : ""
    filter += queryParams.manufacture_ids
      ? " AND da.manufacture_id IN {manufacture_ids:Array(Int64)}"
      : ""
    filter += queryParams.province_ids
      ? " AND da.province_id IN {province_ids:Array(Int64)}"
      : ""
    filter += queryParams.regency_ids
      ? " AND da.regency_id IN {regency_ids:Array(Int64)}"
      : ""
    filter += queryParams.entity_ids
      ? " AND da.entity_id IN {entity_ids:Array(Int64)}"
      : ""
    filter += queryParams.entity_tag_ids
      ? " AND da.entity_tag_id IN {entity_tag_ids:Array(Int64)}"
      : ""
    filter += queryParams.model_ids
      ? " AND da.model_id IN {model_ids:Array(Int64)}"
      : ""
    filter += queryParams.statuses
      ? " AND da.status IN {statuses:Array(Int64)}"
      : ""
    filter += queryParams.power_available_ids
      ? " AND da.asset_electricity_id IN {power_available_ids:Array(Int64)}"
      : ""
    filter += queryParams.ownership_status_ids
      ? " AND da.ownership_status IN {ownership_status_ids:Array(Int64)}"
      : ""
    filter += queryParams.prod_years
      ? " AND da.production_year IN {prod_years:Array(Int64)}"
      : ""
    filter += queryParams.vendor_ids
      ? " AND (da.warranty_asset_vendor_id IN {vendor_ids:Array(Int64)} OR da.calibration_asset_vendor_id IN {vendor_ids:Array(Int64)} OR da.maintenance_asset_vendor_id IN {vendor_ids:Array(Int64)})"
      : ""
    filter += queryParams.communication_provider_ids
      ? " AND da.asset_communication_provider_id IN {communication_provider_ids:Array(Int64)}"
      : ""
    filter += queryParams.asset_capacity_ids
      ? " AND da.capacity_status_id IN {asset_capacity_ids:Array(Int64)}"
      : ""
    filter += queryParams.budget_years
      ? " AND da.budget_year IN {budget_years:Array(Int64)}"
      : ""
    filter += queryParams.working_status_ids
      ? " AND da.working_status_id IN {working_status_ids:Array(Int64)}"
      : ""
    filter += queryParams.is_deleted === "1"
      ? " AND (da.deleted_at IS NOT NULL AND da.deleted_at < {to:DateTime('Asia/Jakarta')})"
      : " AND (da.deleted_at > {to:DateTime('Asia/Jakarta')} OR da.deleted_at IS NULL)"
    filter += queryParams.from
      ? " AND da.created_at >= {from:DateTime('Asia/Jakarta')}"
      : ""
    filter += queryParams.to
      ? " AND da.created_at <= {to:DateTime('Asia/Jakarta')}"
      : ""
    rtmdFilter += filter

    // rtmd asset type is static so need not to filter its type
    filter += queryParams.type_ids
      ? " AND da.type_id IN {type_ids:Array(Int64)}"
      : " AND da.type_id IS NOT NULL"

    return { filter, rtmdFilter }
  }

  /**
   * Build query for asset ownership overview
   */
  buildAssetOwnershipOverviewQuery(
    queryParams: AssetInventoryQueryParams,
    groupBy: string
  ): string {
    const { filter, rtmdFilter } = this.#generateFilters(queryParams)

    const query = `
      SELECT
        daa.${groupBy} AS element_id,
        daa.type_id AS type_id,
        SUM(
            CASE
                WHEN has(asset_classifications_name, 'shared')
                    THEN toUInt64(COALESCE(daa.ownership_qty, 1))
                ELSE 1
            END
        ) AS qty
      FROM (
        SELECT DISTINCT
          da.id AS id,
          da.type_id AS type_id,
          da.province_id AS province_id,
          da.regency_id AS regency_id,
          da.entity_id AS entity_id,
          da.entity_tag_id AS entity_tag_id,
          da.entity_type_id AS entity_type_id,
          da.ownership_qty AS ownership_qty,
          da.asset_classifications_name
        FROM
          datamart_assets_v5 da FINAL
        WHERE
          da.status = 1
          ${filter}
      ) daa
      GROUP BY
        element_id,
        daa.type_id
      ORDER BY daa.type_id ASC
    `

    // no rtmd on filter, return only asset inventory
    if (
      queryParams.type_ids &&
      !queryParams.type_ids.includes(queryParams.rtmd_type_id ?? 0)
    ) {
      return query.trim()
    }

    // union result from asset inventory with rtmd
    return `
      ${query}
      UNION ALL
      SELECT
        daa.${groupBy} AS element_id,
        ${queryParams.rtmd_type_id} AS type_id,
        SUM(daa.rtmds_qty) AS qty
      FROM (
        SELECT DISTINCT
          da.id AS id,
          da.type_id AS type_id,
          da.province_id AS province_id,
          da.regency_id AS regency_id,
          da.entity_id AS entity_id,
          da.entity_tag_id AS entity_tag_id,
          da.entity_type_id AS entity_type_id,
          toUInt64(COALESCE(da.rtmds_qty, 0)) AS rtmds_qty,
          da.asset_classifications_name
        FROM
          datamart_assets_v5 da FINAL
        WHERE
          da.status = 1
          ${rtmdFilter}
      ) daa
      GROUP BY
        element_id
    `
  }

  buildAssetOwnershipTableQuery(
    queryParams: AssetInventoryQueryParams,
    groupBy: string
  ): string {
    const overviewQuery = this.buildAssetOwnershipOverviewQuery(
      queryParams,
      groupBy
    )

    return `
      WITH dai AS
      (
        SELECT
          element_id,
          sum(qty) AS total_qty,
          mapFromArrays(
              groupArray(toString(type_id)),
              groupArray(qty)
          ) AS qty_by_type
        FROM
        (
          ${overviewQuery}
        )
        GROUP BY
          element_id
      )
    `
  }

  #generateEntityFilters(queryParams: AssetInventoryQueryParams): string {
    let filter = ""
    filter += queryParams.entity_ids
      ? " AND id IN {entity_ids:Array(Int64)}"
      : ""
    filter += queryParams.entity_tag_ids
      ? " AND entity_tag_id IN {entity_tag_ids:Array(Int64)}"
      : ""
    filter += queryParams.province_ids
      ? " AND province_id IN {province_ids:Array(Int64)}"
      : ""
    filter += queryParams.regency_ids
      ? " AND regency_id IN {regency_ids:Array(Int64)}"
      : ""
    return filter
  }

  buildParentEntitiesQuery(queryParams: AssetInventoryQueryParams): string {
    const filters = this.#generateEntityFilters(queryParams)
    const tableQuery = this.buildAssetOwnershipTableQuery(queryParams, "entity_id")
    const query = `
      ${tableQuery}
      SELECT
        id,
        name,
        qty_by_type,
        total_qty
      FROM
        raw_entities e FINAL
      LEFT JOIN dai
        ON e.id = dai.element_id
      WHERE
        village_id IS NULL
        ${
          queryParams.regency_ids
            ? `AND regency_id IN {regency_ids:Array(Int64)} AND type = ${ENTITY_TYPE.REGENCY}`
            : ""
        }
        ${
          queryParams.province_ids && !queryParams.regency_ids
            ? `AND province_id IN {province_ids:Array(Int64)} AND type = ${ENTITY_TYPE.PROVINCE}`
            : ""
        }
        ${filters}
      ORDER BY
        total_qty DESC,
        name ASC
      ${queryParams.paginate >= 0 ? `LIMIT ${queryParams.paginate}` : ""}
      ${queryParams.paginate >= 0 ? `OFFSET ${queryParams.offset}` : ""}
    `
    return query.trim()
  }

  buildCountParentEntitiesQuery(
    queryParams: AssetInventoryQueryParams
  ): string {
    const filters = this.#generateEntityFilters(queryParams)
    const query = `
      SELECT
        COUNT(*) as total
      FROM
        raw_entities FINAL
      WHERE
        village_id IS NULL
        ${
          queryParams.regency_ids
            ? `AND regency_id IN {regency_ids:Array(Int64)} AND type = ${ENTITY_TYPE.REGENCY}`
            : ""
        }
        ${
          queryParams.province_ids && !queryParams.regency_ids
            ? `AND province_id IN {province_ids:Array(Int64)} AND type = ${ENTITY_TYPE.PROVINCE}`
            : ""
        }
        ${filters}
    `
    return query.trim()
  }

  buildChildEntitiesQuery(queryParams: AssetInventoryQueryParams, groupBy: string): string {
    const filters = this.#generateEntityFilters(queryParams)
    const tableQuery = this.buildAssetOwnershipTableQuery(queryParams, groupBy)
    let query = ""

    if (
      queryParams.entity_ids ||
      queryParams.entity_tag_ids ||
      queryParams.regency_ids
    ) {
      query = `
        ${tableQuery}
        SELECT
          id,
          name,
          qty_by_type,
          total_qty
        FROM
          raw_entities e FINAL
        LEFT JOIN dai
          ON e.id = dai.element_id
        WHERE
          1=1
          ${
            queryParams.regency_ids
              ? `AND regency_id IN {regency_ids:Array(Int64)} AND type = ${ENTITY_TYPE.HEALTHCARE_FACILITY} AND is_puskesmas = 1`
              : ""
          }
          ${filters}
        ORDER BY
          total_qty DESC,
          name ASC
        ${queryParams.paginate >= 0 ? `LIMIT ${queryParams.paginate}` : ""}
        ${queryParams.paginate >= 0 ? `OFFSET ${queryParams.offset}` : ""}
      `
    } else {
      query = `
        ${tableQuery}
        SELECT
          id,
          name,
          qty_by_type,
          total_qty
        FROM
          raw_locations l FINAL
        LEFT JOIN dai
          ON l.id = dai.element_id
        WHERE
          1=1
          ${
            queryParams.province_ids
              ? `AND parent_id IN {province_ids:Array(Int64)}`
              : ""
          }
          AND level = ${
            queryParams.province_ids
              ? LOCATION_LEVEL.REGENCY
              : LOCATION_LEVEL.PROVINCE
          }
        ORDER BY
          total_qty DESC,
          name ASC
        ${queryParams.paginate >= 0 ? `LIMIT ${queryParams.paginate}` : ""}
        ${queryParams.paginate >= 0 ? `OFFSET ${queryParams.offset}` : ""}
      `
    }
    return query.trim()
  }

  buildCountChildEntitiesQuery(queryParams: AssetInventoryQueryParams): string {
    const filters = this.#generateEntityFilters(queryParams)
    let query = ""

    if (
      queryParams.entity_ids ||
      queryParams.entity_tag_ids ||
      queryParams.regency_ids
    ) {
      query = `
        SELECT
          COUNT(*) AS total
        FROM
          raw_entities FINAL
        WHERE
          1=1
          ${
            queryParams.regency_ids
              ? `AND regency_id IN {regency_ids:Array(Int64)} AND type = ${ENTITY_TYPE.HEALTHCARE_FACILITY} AND is_puskesmas = 1`
              : ""
          }
          ${filters}
      `
    } else {
      query = `
        SELECT
          COUNT(*) AS total
        FROM
          raw_locations FINAL
        WHERE
          1=1
          ${
            queryParams.province_ids
              ? `AND parent_id IN {province_ids:Array(Int64)}`
              : ""
          }
          AND level = ${
            queryParams.province_ids
              ? LOCATION_LEVEL.REGENCY
              : LOCATION_LEVEL.PROVINCE
          }
      `
    }
    return query.trim()
  }
}
