import { Context } from "hono"
import {
  InventoryOverviewQueryParams,
  TemperatureOverviewQueryParams,
} from "./inventory-overview.schema.js"

export class InventoryOverviewQuery {
  buildInventoryQuery(
    c: Context,
    queryParams: InventoryOverviewQueryParams
  ): string {
    const filters: string[] = []
    const {
      province_id,
      regency_id,
      entity_id,
      entity_tag_id,
      activity_ids,
      material_ids,
      material_type_id,
    } = queryParams
    const programId = c.var.programId

    if (entity_tag_id) {
      filters.push(`dri.entities_tag_id = {entity_tag_id:Int64}`)
    }

    if (material_ids && material_ids.length > 0) {
      filters.push(`dri.parent_material_id in {material_ids:Array(Int64)}`)
    }

    if (province_id) {
      filters.push(`dri.entities_province_id = {province_id:Int64}`)
    }

    if (regency_id) {
      filters.push(`dri.entities_regency_id = {regency_id:Int64}`)
    }

    if (activity_ids && activity_ids.length > 0) {
      filters.push(
        `dri.transactions_activity_id in {activity_ids:Array(Int64)}`
      )
    }

    if (material_type_id) {
      filters.push(`dri.material_type_id = {material_type_id:Int64}`)
    }

    // Build location selection based on hierarchical logic
    let locationSelect = ""
    if (entity_id || entity_tag_id || (province_id && regency_id)) {
      // Both province and regency specified or entity specified - group by entity
      locationSelect = `dri.entities_id as location_id,`
    } else if (province_id && !regency_id) {
      // Only province specified - group by regency
      locationSelect = `dri.entities_regency_id as location_id,`
    } else {
      // No geographic filters - group by province
      locationSelect = `dri.entities_province_id as location_id,`
    }

    const filterClause =
      filters.length > 0 ? `AND ${filters.join(" AND ")}` : ""

    return `
      SELECT 
        ${locationSelect}
        argMax(dri.transactions_id, toDate(dri.transactions_created_at)) as transactions_id,
        dri.parent_material_id as transactions_master_material_id,
        dri.parent_material_name as transactions_master_material_name,
        argMax(dri.transactions_activity_id, toDate(dri.transactions_created_at)) as transactions_activity_id,
        dri.entities_id as entities_id,
        argMax(dri.entities_name, toDate(dri.transactions_created_at)) as entities_name,
        argMax(dri.entities_province_id, toDate(dri.transactions_created_at)) as entities_province_id,
        argMax(dri.entities_province_name, toDate(dri.transactions_created_at)) as entities_province_name,
        argMax(dri.entities_regency_id, toDate(dri.transactions_created_at)) as entities_regency_id,
        argMax(dri.entities_regency_name, toDate(dri.transactions_created_at)) as entities_regency_name,
        max(dri.transactions_created_at) as transactions_created_at,
        dri.entity_master_material_activities_id as entity_master_material_activities_id,
        argMax(dri.ema_min, toDate(dri.transactions_created_at)) as ema_min,
        argMax(dri.ema_max, toDate(dri.transactions_created_at)) as ema_max,
        argMax(dri.transactions_round_balance_qty, toDate(dri.transactions_created_at)) as transactions_round_balance_qty,
        argMax(dri.status, toDate(dri.transactions_created_at)) as status
      FROM datamart_rutin_inventory_v5 dri FINAL
      PREWHERE 
        dri.program_id = ${programId}
      WHERE
        dri.transactions_created_at <= {to:DateTime('Asia/Jakarta')}
        AND dri.entities_join_date <= {to:DateTime('Asia/Jakarta')}
        ${filterClause}
      GROUP BY location_id, dri.entities_id, dri.parent_material_id, dri.parent_material_name, dri.entity_master_material_activities_id
    `
  }

  buildLastUpdatedQuery(): string {
    return `
      SELECT max(toDate(dri.transactions_created_at)) as last_update 
      FROM datamart_rutin_inventory_v5 dri 
      FINAL
    `
  }

  buildActiveEntitiesQuery(
    c: Context,
    queryParams: InventoryOverviewQueryParams
  ): string {
    const programId = c.var.programId
    const filters: string[] = []

    if (queryParams.entity_tag_id) {
      filters.push(`dt.entity_tags_id = {entity_tag_id:Int64}`)
    }

    if (queryParams.material_ids && queryParams.material_ids.length > 0) {
      filters.push(
        `dt.transactions_master_material_id in {material_ids:Array(Int64)}`
      )
    }

    if (queryParams.province_id) {
      filters.push(`dt.entities_province_id = {province_id:Int64}`)
    }

    if (queryParams.regency_id) {
      filters.push(`dt.entities_regency_id = {regency_id:Int64}`)
    }

    if (queryParams.activity_ids && queryParams.activity_ids.length > 0) {
      filters.push(`dt.transactions_activity_id in {activity_ids:Array(Int64)}`)
    }

    const filterClause =
      filters.length > 0 ? `AND ${filters.join(" AND ")}` : ""

    return `
      SELECT
        dt.entities_id as entityId
      FROM datamart_transactions_v5 dt FINAL
      PREWHERE 
        dt.program_id = ${programId}
      WHERE
        dt.transactions_created_at BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}
        AND dt.transactions_transaction_type_id = 2
        AND dt.entities_status = 1
        AND dt.entities_is_vendor = 1
        AND dt.join_date <= {to:DateTime('Asia/Jakarta')}
        AND (dt.end_date >= {to:DateTime('Asia/Jakarta')} OR dt.end_date IS NULL)
        ${filterClause}
      GROUP BY dt.entities_id
    `
  }

  buildLastActivityUpdateQuery(): string {
    return `
      SELECT max(dt.transactions_created_at) as last_update 
      FROM datamart_transactions_v5 dt FINAL 
      WHERE transactions_transaction_type_id = 2
    `
  }

  private buildTemperatureFilters(
    queryParams: TemperatureOverviewQueryParams
  ): { filters: string[]; filterClause: string } {
    const filters: string[] = []
    const { province_id, regency_id, entity_tag_id } = queryParams

    if (entity_tag_id) {
      filters.push(`dlm.entity_tag_id = {entity_tag_id:Int64}`)
    }

    if (province_id) {
      filters.push(`toInt64(dlm.province_id) = {province_id:Int64}`)
    }

    if (regency_id) {
      filters.push(`toInt64(dlm.regency_id) = {regency_id:Int64}`)
    }

    const filterClause =
      filters.length > 0 ? `AND ${filters.join(" AND ")}` : ""

    return { filters, filterClause }
  }

  buildTemperatureOverviewQuery(
    c: Context,
    queryParams: TemperatureOverviewQueryParams
  ): string {
    const { filterClause } = this.buildTemperatureFilters(queryParams)

    return `
      SELECT
        latest_status_excursion,
        countDistinct(asset_inventory_id) AS inventory_count
      FROM
      (
        SELECT
          dlm.asset_inventory_id as asset_inventory_id,
          argMax(latest_status_excursion, dlm.max_datetime) AS latest_status_excursion
        FROM datamart_logger_monitoring dlm FINAL
        WHERE
          dlm.asset_inventory_id is not null
          AND has(dlm.asset_classifications_id, 1)
          AND dlm.logger_date = toDate({to:DateTime('Asia/Jakarta')})
          ${filterClause}
        GROUP BY dlm.asset_inventory_id
      )
      GROUP BY latest_status_excursion
    `
  }

  buildTemperatureLocationQuery(
    c: Context,
    queryParams: TemperatureOverviewQueryParams
  ): string {
    const { filterClause } = this.buildTemperatureFilters(queryParams)

    // Build location selection based on hierarchical logic
    let locationSelect = ""
    if (queryParams.province_id && queryParams.regency_id) {
      // Both province and regency specified - group by regency
      locationSelect = `toInt64(regency_id) as location_id,`
    } else if (queryParams.province_id && !queryParams.regency_id) {
      // Only province specified - group by regency
      locationSelect = `toInt64(regency_id) as location_id,`
    } else {
      // No geographic filters - group by province
      locationSelect = `toInt64(province_id) as location_id,`
    }

    return `
      SELECT
      	${locationSelect}
        latest_status_excursion,
        countDistinct(asset_inventory_id) AS inventory_count
      FROM
      (
        SELECT
          dlm.entity_id as entity_id,
          dlm.asset_inventory_id as asset_inventory_id,
          argMax(dlm.latest_status_excursion, dlm.max_datetime) AS latest_status_excursion,
          dlm.province_id as province_id,
          dlm.regency_id as regency_id
        FROM datamart_logger_monitoring dlm FINAL
        WHERE
          dlm.asset_inventory_id is not null
          AND has(dlm.asset_classifications_id, 1)
          AND dlm.logger_date = toDate({to:DateTime('Asia/Jakarta')})
          ${filterClause}
        GROUP BY entity_id, dlm.asset_inventory_id, dlm.province_id, dlm.regency_id
      )
      GROUP BY 
      	location_id,
      	latest_status_excursion 
    `
  }

  private buildDenominatorFilters(
    queryParams: TemperatureOverviewQueryParams
  ): { filters: string[]; filterClause: string } {
    const filters: string[] = []
    const { province_id, regency_id, entity_tag_id, working_status_id } =
      queryParams

    if (entity_tag_id) {
      filters.push(`dav.entity_tag_id = {entity_tag_id:Int64}`)
    }

    if (province_id) {
      filters.push(`dav.province_id = {province_id:Int64}`)
    }

    if (regency_id) {
      filters.push(`dav.regency_id = {regency_id:Int64}`)
    }

    if (working_status_id) {
      filters.push(`dav.working_status_id = {working_status_id:Int64}`)
    }

    const filterClause =
      filters.length > 0 ? `AND ${filters.join(" AND ")}` : ""

    return { filters, filterClause }
  }

  buildTemperatureDenominatorOverviewQuery(
    c: Context,
    queryParams: TemperatureOverviewQueryParams
  ): string {
    const { filterClause } = this.buildDenominatorFilters(queryParams)

    return `
      SELECT
        COUNT(DISTINCT dav.id) as total_inventory_count
      FROM
        datamart_assets_v5 dav FINAL
      WHERE
        dav.entity_status = 1
        AND dav.deleted_at IS NULL
        AND dav.entity_deleted_at IS NULL
        AND has(dav.asset_classifications_id, 1)
        AND dav.rtmds_qty > 0
        AND dav.asset_rtmd_id IS NOT NULL
        ${filterClause}
    `
  }

  buildTemperatureDenominatorLocationQuery(
    c: Context,
    queryParams: TemperatureOverviewQueryParams
  ): string {
    const { filterClause } = this.buildDenominatorFilters(queryParams)

    // Build location selection based on hierarchical logic
    let locationSelect = ""
    if (queryParams.province_id && queryParams.regency_id) {
      // Both province and regency specified - group by regency
      locationSelect = `dav.regency_id as location_id,`
    } else if (queryParams.province_id && !queryParams.regency_id) {
      // Only province specified - group by regency
      locationSelect = `dav.regency_id as location_id,`
    } else {
      // No geographic filters - group by province
      locationSelect = `dav.province_id as location_id,`
    }

    return `
      SELECT
        ${locationSelect}
        COUNT(DISTINCT dav.id) as total_inventory_count
      FROM
        datamart_assets_v5 dav FINAL
      WHERE
        dav.entity_status = 1
        AND dav.deleted_at IS NULL
        AND dav.entity_deleted_at IS NULL
        AND has(dav.asset_classifications_id, 1)
        AND dav.rtmds_qty > 0
        AND dav.asset_rtmd_id IS NOT NULL
        ${filterClause}
      GROUP BY location_id
    `
  }

  buildLastTemperatureUpdateQuery(): string {
    return `
      SELECT max(dlm.updated_at) as last_update 
      FROM datamart_logger_monitoring dlm 
    `
  }
}
