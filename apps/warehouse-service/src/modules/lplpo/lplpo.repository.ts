import { db, execQuery } from "@/common/infrastructure/database/index.js"
import { DB } from "@/common/infrastructure/database/types/db.js"

import { Context } from "@smile/lib/types/context.js"

import moment from "moment"
export class LplpoRepository {
  async getLplpoData(c: Context<DB>, page: number, limit: number, query: any) {
    try {
      const {
        entityId,
        activityId,
        provinceId,
        regencyId,
        subDistrictId,
        month, // 1-12 for monthly filter
        year, // year filter
        search,
        programId,
      } = query

      let whereClauses = ""

      if (entityId) {
        whereClauses += ` AND dt.entities_id = ${entityId} `
      }
      if (activityId) {
        whereClauses += ` AND dt.transactions_activity_id IN (${activityId}) `
      }
      if (provinceId) {
        whereClauses += ` AND dt.province_id = ${provinceId} `
      }
      if (regencyId) {
        whereClauses += ` AND dt.regency_id = ${regencyId} `
      }
      if (subDistrictId) {
        whereClauses += ` AND dt.sub_district_id = ${subDistrictId} `
      }
      if (search) {
        whereClauses += ` AND dt.dt.entities_name LIKE '%${search}%' `
      }
      if (programId) {
        whereClauses += ` AND dt.program_id = ${programId} `
      }

      const querydata = `
              SELECT
    dt.program_id,
    dt.transactions_activity_id,
    dt.transactions_activity_name,
    dt.province_id,
    dt.province_name,
    dt.regency_id,
    dt.regency_name,
    dt.entities_id AS entity_id,
    dt.entities_name,
    months.period_start AS date,
    toMonth(months.period_start) AS month_number,
    dt.parent_material_id,
    dt.parent_material_name,
--    dt.material_id,
--  dt.material_name,
    dt.dmm_unit_of_consumption_name,
--    dt.batches_code,
--    dt.expired_date,
    dt.budget_source_name,
    -- Opening Balance
    COALESCE(
        argMaxIf(
            dt.balance_per_entity_parent_materials,
            dt.transactions_id,
            toDate(dt.transactions_created_at + toIntervalHour(7)) < months.period_start
        ), 0
    ) AS opening_qty,
--    COALESCE(
--        argMaxIf(
--            dt.balance_per_entity_parent_materials,
--            dt.transactions_created_at,
--            toDate(dt.transactions_created_at + toIntervalHour(7)) < months.period_start
--        ), 0
--    ) AS opening_qty_gpt,
    -- Received
    COALESCE(
        sumIf(dt.transactions_change_qty,
            dt.transactions_transaction_type_id = 3
            AND dt.transactions_order_id IS NOT NULL
            AND dt.orders_order_type_id IN (1, 2, 4, 7)
            AND dt.orders_order_status_id = 5
            AND toStartOfMonth(toDate(dt.transactions_created_at + toIntervalHour(7))) = months.period_start
        ), 0
    )
    + COALESCE(
        sumIf(dt.transactions_change_qty,
            dt.transactions_transaction_type_id = 3
            AND dt.transactions_order_id IS NOT NULL
            AND dt.orders_order_type_id = 3
            AND dt.orders_order_status_id = 5
            AND toStartOfMonth(toDate(dt.transactions_created_at + toIntervalHour(7))) = months.period_start
        ), 0
    ) AS received_qty,
    -- Consumption
    COALESCE(
        sumIf(dt.transactions_change_qty * -1,
            dt.transactions_transaction_type_id IN (10, 5)
            AND dt.transactions_order_id IS NULL
            AND toStartOfMonth(toDate(dt.transactions_created_at + toIntervalHour(7))) = months.period_start
        ), 0
    )
    + COALESCE(
        sumIf(dt.transactions_change_qty * -1,
            dt.transactions_transaction_type_id = 2
            AND dt.transactions_order_id IS NOT NULL
            AND dt.orders_order_type_id IN (1, 2, 4, 7)
            AND dt.orders_order_status_id IN (4, 5)
            AND toStartOfMonth(toDate(dt.transactions_created_at + toIntervalHour(7))) = months.period_start
        ), 0
    )
    + COALESCE(
        sumIf(dt.transactions_change_qty * -1,
            dt.transactions_transaction_type_id = 2
            AND dt.transactions_order_id IS NOT NULL
            AND dt.orders_order_type_id = 3
            AND dt.orders_order_status_id IN (4, 5)
            AND toStartOfMonth(toDate(dt.transactions_created_at + toIntervalHour(7))) = months.period_start
        ), 0
    ) AS consumption_qty,
    -- Closing Balance
    COALESCE(
        argMaxIf(
            dt.balance_per_entity_parent_materials,
            dt.transactions_id,
            toDate(dt.transactions_created_at + toIntervalHour(7)) < addMonths(months.period_start, 1)
        ), 0
    ) AS closing_qty
FROM dashboard_medical_requests dt final
CROSS JOIN (
    SELECT 
        toDate(concat(toString(${year}), '-', leftPad(toString(number), 2, '0'), '-01')) AS period_start
    FROM numbers(1, 12)
    WHERE (${month} = 0 OR number = ${month})
) months
WHERE
    
    
    (dt.join_date <= now() AND (dt.end_date >= now() OR dt.end_date IS NULL))
    AND toYear(toDate(dt.transactions_created_at + toIntervalHour(7))) <= ${year}
    AND toDate(dt.transactions_created_at + toIntervalHour(7)) < addMonths(months.period_start, 1)
            ${whereClauses}
                         
        GROUP BY
    dt.program_id,
    dt.transactions_activity_id,
    dt.transactions_activity_name,
    dt.province_id,
    dt.province_name,
    dt.regency_id,
    dt.regency_name,
    dt.entities_id,
    dt.entities_name,
    months.period_start,
    dt.parent_material_id,
    dt.parent_material_name,
--    dt.material_id,
--  dt.material_name,
    dt.dmm_unit_of_consumption_name,
--    dt.batches_code,
--    dt.expired_date,
    dt.budget_source_name
ORDER BY
--    batches_code,
    month_number;
        `
      console.log("LPLPO Final Query data:", querydata)
      const rows: any = await execQuery(querydata)
      console.log("LPLPO Data Rows:", rows.length)

      return rows
    } catch (error) {
      console.error("Error in getLplpoData:", error)
      return Promise.reject(error)
    }
  }

  async getMaterialByEntityId(
    c: Context<DB>,
    entityId?: string,
    type?: "parent" | "child",
    region?: {
      provinceId?: string
      regencyId?: string
      programId?: string
    }
  ) {
    type = type || "parent"

    let whereClauses = ""

    if (entityId !== "") {
      whereClauses += ` and dwema.ema_entity_id IN (${entityId}) `
    }

    if (region?.provinceId) {
      whereClauses += ` and dwema.entity_province_id = '${region.provinceId}' `
    }

    if (region?.regencyId) {
      whereClauses += ` and dwema.entity_regency_id = '${region.regencyId}' `
    }

    if (region?.programId) {
      whereClauses += ` and dwema.program_id = '${region.programId}' `
    }

    let select = ""
    if (type === "parent") {
      select = ` DISTINCT 
        dwema.ema_entity_id as entity_id,
        dwema.entity_name as entities_name, 
        dwema.ema_material_id as parent_material_id,
        dwema.material_name as parent_material_name,
        rwm.unit_of_consumption as dmm_unit_of_consumption_name,
        dwema.entity_province_name as province_name,
        dwema.entity_province_id as province_id,
        dwema.entity_regency_name as regency_name `
    }

    if (type === "child") {
      select = ` DISTINCT 
      dwema.ema_entity_id as entity_id,
      dwema.entity_name as entities_name, 
      dwema.ema_material_id as parent_material_id,
      dwema.material_name as parent_material_name,
      rwm.id as material_id,
      rwm.name as material_name,
      rwm.unit_of_consumption as dmm_unit_of_consumption_name,
      dwema.activity_name as transactions_activity_name,
      dwema.entity_activity_id as transactions_activity_id,
      dwema.entity_province_name as province_name,
      dwema.entity_province_id as province_id,
      dwema.entity_regency_name as regency_name,
      dwema.entity_regency_id as regency_id,
      rw.id as program_id,
      rw.name as program_name `
    }

    const query =
      `
        select 
          ${select}
        from dim_ws_entity_material_activities dwema FINAL
        JOIN (
              SELECT
                rwea_inner.id,
                rwea_inner.entity_id,
                rwea_inner.activity_id
              FROM bronze_layer_v5_staging.raw_ws_entity_activities as rwea_inner FINAL
              WHERE
              rwea_inner.deleted_at is null 
                and rwea_inner.start_date is not null
                and (
                  (start_date <= today() and end_date >= today())
                  or (end_date is null and start_date <= today())
                )
            ) as rwea ON rwea.entity_id = dwema.ema_entity_id and rwea.activity_id = dwema.ema_activity_id 
        join bronze_layer_v5_staging.raw_ws_materials rwm FINAL on dwema.ema_material_id = rwm.parent_id
        join bronze_layer_v5_staging.raw_workspaces rw FINAL on dwema.program_id = rw.id and rw.deleted_at is null
        where dwema.ema_deleted_at is null and dwema.entity_deleted_at is null
        and dwema.entity_status = 1 and dwema.entity_is_vendor = 1 ` +
      whereClauses

    console.log("Get Parent Material By Entity Query:", query)
    const rows: any = await execQuery(query)
    console.log("LPLPO Data Rows:", rows.length)
    return rows
  }

  async getLplpoDataExport(c: Context<DB>, query: any) {
    try {
      let {
        entityId,
        activityId,
        provinceId,
        regencyId,
        subDistrictId,
        period, // "monthly" or "yearly"
        month, // 1-12 for monthly filter
        year, // year filter
        programId,
      } = query

      let whereClauses = ""

      if (entityId) {
        whereClauses += ` AND dt.entities_id = ${entityId} `
      }

      // Filter by month and/or year
      if (month && year) {
        whereClauses += ` AND toYear(toDate(dt.transactions_created_at + toIntervalHour(7))) <= ${year} `
      }

      if (activityId) {
        whereClauses += ` AND dt.stock_activity_id IN (${activityId}) `
      }

      if (provinceId) {
        whereClauses += ` AND dt.province_id = ${provinceId} `
      }
      if (regencyId) {
        whereClauses += ` AND dt.regency_id = ${regencyId} `
      }
      if (subDistrictId) {
        whereClauses += ` AND dt.sub_district_id = ${subDistrictId} `
      }

      if (programId) {
        whereClauses += ` AND dt.program_id = ${programId} `
      }

      console.log("LPLPO Export whereClauses:", whereClauses)
      const querydata = `
              SELECT
   dt.program_id,
    dt.stock_activity_id,
    dt.stock_activity_name,
    dt.transactions_stock_id,
    dt.province_id,
    dt.province_name,
    dt.regency_id,
    dt.regency_name,
    dt.entities_id AS entity_id,
    dt.entities_name,
    months.period_start AS date,
    toMonth(months.period_start) AS month_number,
    dt.parent_material_id,
    dt.parent_material_name,
    dt.material_id,
  dt.material_name,
    dt.dmm_unit_of_consumption_name,
    dt.batches_code,
    dt.expired_date,
    dt.budget_source_name,
    -- Opening Balance
   COALESCE(
        argMaxIf(
            dt.balance_per_entity_stock_material_activity_batches,
            dt.transactions_id,
            toDate(dt.transactions_created_at + toIntervalHour(7)) < months.period_start
        ), 0
    ) AS opening_qty,
    -- Received
    COALESCE(
        sumIf(dt.transactions_change_qty,
            dt.transactions_transaction_type_id = 3
            AND dt.transactions_order_id IS NOT NULL
            AND dt.orders_order_type_id IN (1, 2, 4, 7)
            AND dt.orders_order_status_id = 5
            AND toStartOfMonth(toDate(dt.transactions_created_at + toIntervalHour(7))) = months.period_start
        ), 0
    )
    + COALESCE(
        sumIf(dt.transactions_change_qty,
            dt.transactions_transaction_type_id = 3
            AND dt.transactions_order_id IS NOT NULL
            AND dt.orders_order_type_id = 3
            AND dt.orders_order_status_id = 5
            AND toStartOfMonth(toDate(dt.transactions_created_at + toIntervalHour(7))) = months.period_start
        ), 0
    ) AS received_qty,
    -- Consumption
    COALESCE(
        sumIf(dt.transactions_change_qty * -1,
            dt.transactions_transaction_type_id IN (10, 5)
            AND dt.transactions_order_id IS NULL
            AND toStartOfMonth(toDate(dt.transactions_created_at + toIntervalHour(7))) = months.period_start
        ), 0
    )
    + COALESCE(
        sumIf(dt.transactions_change_qty * -1,
            dt.transactions_transaction_type_id = 2
            AND dt.transactions_order_id IS NOT NULL
            AND dt.orders_order_type_id IN (1, 2, 4, 7)
            AND dt.orders_order_status_id IN (4, 5)
            AND toStartOfMonth(toDate(dt.transactions_created_at + toIntervalHour(7))) = months.period_start
        ), 0
    )
    + COALESCE(
        sumIf(dt.transactions_change_qty * -1,
            dt.transactions_transaction_type_id = 2
            AND dt.transactions_order_id IS NOT NULL
            AND dt.orders_order_type_id = 3
            AND dt.orders_order_status_id IN (4, 5)
            AND toStartOfMonth(toDate(dt.transactions_created_at + toIntervalHour(7))) = months.period_start
        ), 0
    ) AS consumption_qty,
    -- Closing Balance
    COALESCE(
        argMaxIf(
            dt.balance_per_entity_stock_material_activity_batches,
            dt.transactions_id, 
            toDate(dt.transactions_created_at + toIntervalHour(7)) < addMonths(months.period_start, 1)
        ), 0
    ) AS closing_qty
FROM dashboard_medical_requests dt FINAL
CROSS JOIN (
    SELECT 
        toDate(concat(toString(${year}), '-', leftPad(toString(number), 2, '0'), '-01')) AS period_start
    FROM numbers(1, 12)
    WHERE (${month} = 0 OR number = ${month})
) months
WHERE
1=1 AND toDate(dt.transactions_created_at + toIntervalHour(7)) < addMonths(months.period_start, 1) 
AND (dt.join_date <= now() AND (dt.end_date >= now() OR dt.end_date IS NULL))
 ${whereClauses}
GROUP BY
    dt.program_id,
    dt.transactions_stock_id,
    dt.stock_activity_id,
    dt.stock_activity_name,
    dt.province_id,
    dt.province_name,
    dt.regency_id,
    dt.regency_name,
    dt.entities_id,
    dt.entities_name,
    months.period_start,
    dt.parent_material_id,
    dt.parent_material_name,
    dt.material_id,
  dt.material_name,
    dt.dmm_unit_of_consumption_name,
    dt.batches_code,
    dt.expired_date,
    dt.budget_source_name
ORDER BY
    batches_code,
    month_number
    `
      console.log("LPLPO Final Query data:", querydata)
      const rows: any = await execQuery(querydata)
      console.log("LPLPO Data Rows:", rows.length)

      return rows
    } catch (error) {
      console.error("Error in getLplpoDataExport:", error)
      return Promise.reject(error)
    }
  }
}
