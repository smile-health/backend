import { Context } from "hono"
import { SmileVsAsikQueryParams } from "./smile-vs-asik.schema.js"
import { KFA_LEVEL_CODE } from "@/common/constants/material.js"

export class SmileVsAsikQuery {
  private generateLocationClauses(queryParams: SmileVsAsikQueryParams): {
    selectFields: string
    groupBy: string
  } {
    const { entity_id, province_id, regency_id } = queryParams

    let selectFields: string
    const groupBy: string = "location_id, location_name"

    if (entity_id || (province_id && regency_id)) {
      selectFields =
        "dt.entities_id as location_id, dt.entities_name as location_name,"
    } else if (province_id && !regency_id) {
      selectFields =
        "dt.entities_regency_id as location_id, dt.entities_regency_name as location_name,"
    } else {
      selectFields =
        "dt.entities_province_id as location_id, dt.entities_province_name as location_name,"
    }

    return {
      selectFields,
      groupBy,
    }
  }

  buildSmileQtyQuery(c: Context, queryParams: SmileVsAsikQueryParams): string {
    const {
      province_id,
      regency_id,
      entity_id,
      entity_tag_ids,
      activity_id,
      material_id,
      material_level_id,
      material_type_id,
    } = queryParams
    const programId = c.var.programId
    const filters: string[] = []

    if (province_id) {
      filters.push(`dt.entities_province_id = {province_id:Int64}`)
    }

    if (regency_id) {
      filters.push(`dt.entities_regency_id = {regency_id:Int64}`)
    }

    if (entity_id) {
      filters.push(`dt.entities_id = {entity_id:Int64}`)
    }

    if (entity_tag_ids && entity_tag_ids.length > 0) {
      filters.push(`dt.entity_tags_id IN {entity_tag_ids:Array(Int64)}`)
    }

    if (activity_id) {
      filters.push(`dt.transactions_activity_id = {activity_id:Int64}`)
    }

    if (
      material_id &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.TEMPLATE
    ) {
      filters.push(`dt.dmm_parent_id = {material_id:Int64}`)
    } else if (
      material_id &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.VARIANT
    ) {
      filters.push(`dt.transactions_master_material_id = {material_id:Int64}`)
    }

    if (material_type_id) {
      filters.push(`dt.material_type_id = {material_type_id:Int64}`)
    }

    const filterClause =
      filters.length > 0 ? `AND ${filters.join(" AND ")}` : ""

    const joinMaterialColumn =
      material_level_id === KFA_LEVEL_CODE.TEMPLATE
        ? "dt.dmm_parent_id"
        : "dt.transactions_master_material_id"

    const { selectFields, groupBy } = this.generateLocationClauses(queryParams)

    // Since material_id is required, the usage of any() is acceptable since it will always filtered by a single material
    return `
      SELECT 
        ${selectFields}
        any(dmm.consumption_unit_per_distribution_unit) AS consumption_unit_per_distribution_unit, 
        SUM(dt.transactions_change_qty * -1) FILTER (WHERE dt.transactions_transaction_type_id IN (10,5) AND dt.transactions_order_id IS NULL) AS smile_qty,
        smile_qty / consumption_unit_per_distribution_unit AS vial
      FROM 
        datamart_transactions_v5 AS dt FINAL 
      INNER JOIN (
        SELECT 
          id, 
          rwm.consumption_unit_per_distribution_unit AS consumption_unit_per_distribution_unit 
        FROM 
          raw_ws_materials AS rwm FINAL 
      ) AS dmm ON dmm.id = ${joinMaterialColumn} 
      PREWHERE 
        dt.transactions_created_at BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}
        AND dt.program_id = ${programId}
      WHERE 
        dt.join_date IS NOT NULL 
        AND (
          (dt.join_date <= {to:DateTime('Asia/Jakarta')} AND dt.end_date >= {to:DateTime('Asia/Jakarta')}) 
          OR (dt.end_date IS NULL AND dt.join_date <= {to:DateTime('Asia/Jakarta')})
        )
        ${filterClause}
      GROUP BY 
        ${groupBy}
      ORDER BY 
        location_id ASC
    `
  }

  private generateAsikLocationClauses(queryParams: SmileVsAsikQueryParams): {
    selectFields: string
  } {
    const { entity_id, province_id, regency_id } = queryParams

    let selectFields: string

    if (entity_id || (province_id && regency_id)) {
      selectFields = "riaa.vendor_id as location_id,"
    } else if (province_id && !regency_id) {
      selectFields = "toInt64(rwe.regency_id) as location_id,"
    } else {
      selectFields = "toInt64(rwe.province_id) as location_id,"
    }

    return {
      selectFields,
    }
  }

  buildAsikQtyQuery(c: Context, queryParams: SmileVsAsikQueryParams): string {
    const {
      province_id,
      regency_id,
      entity_id,
      entity_tag_ids,
      material_level_id,
      material_id,
    } = queryParams
    const filters: string[] = []

    if (province_id) {
      filters.push(`toInt64(rwe.province_id) = {province_id:Int64}`)
    }

    if (regency_id) {
      filters.push(`toInt64(rwe.regency_id) = {regency_id:Int64}`)
    }

    if (entity_id) {
      filters.push(`riaa.vendor_id = {entity_id:Int64}`)
    }

    if (entity_tag_ids && entity_tag_ids.length > 0) {
      filters.push(`rwe.entity_tag_id IN {entity_tag_ids:Array(Int64)}`)
    }

    if (material_id) {
      filters.push(`riaa.material_id = {material_id:Int64}`)
    }

    if (
      material_id &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.TEMPLATE
    ) {
      filters.push(`rwm.parent_id = {material_id:Int64}`)
    } else if (
      material_id &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.VARIANT
    ) {
      filters.push(`rwm.id = {material_id:Int64}`)
    }

    const filterClause =
      filters.length > 0 ? `AND ${filters.join(" AND ")}` : ""

    const { selectFields } = this.generateAsikLocationClauses(queryParams)

    return `
      SELECT
        ${selectFields}
        sum(coalesce(riaa.aggregate, 0)) AS pcare_qty,
        argMax(riaa.injection_date, riaa.id) AS injection_date
      FROM
        raw_integration_asik_aggregate riaa FINAL
      INNER JOIN raw_ws_entities rwe FINAL 
        ON rwe.id = riaa.vendor_id
      LEFT JOIN raw_ws_materials rwm 
        ON riaa.material_id = rwm.id
      WHERE
        riaa.deleted_at IS NULL
        AND riaa.injection_date IS NOT NULL
        AND riaa.injection_date BETWEEN toDate({from:DateTime('Asia/Jakarta')}) AND toDate({to:DateTime('Asia/Jakarta')})
        ${filterClause}
      GROUP BY
        location_id
      ORDER BY
        location_id ASC
    `
  }

  buildLastUpdatedQuery(): string {
    return `
      SELECT 
        max(toDate(riaa.updated_at)) as last_update 
      FROM 
        raw_integration_asik_aggregate riaa
      FINAL
    `
  }
}
