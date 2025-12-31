import { KFA_LEVEL_CODE } from "@/common/constants/material.js"
import {
  StockInventoryBaseQueryParams,
  TransactionType,
} from "./stock-inventory.schema.js"
import { Context } from "hono"
import { STOCK_INVENTORY_TRANSACTION_TYPE } from "@/common/constants/stock-inventory.js"
import {
  ENTITY_IS_VENDOR,
  ENTITY_STATUS,
  ENTITY_TYPE,
} from "@/common/constants/entity.js"

/**
 * Shared query builder for stock inventory modules
 * Used by both stock-availability and abnormal-stock modules
 */
export class StockInventoryQuery {
  /**
   * Build filters for the stock inventory query
   * Shared filtering logic between both modules
   */
  #buildFilters(queryParams: StockInventoryBaseQueryParams): string {
    const {
      province_id,
      regency_id,
      activity_ids,
      material_ids,
      material_level_id,
      material_type_ids,
      entity_tag_ids,
      entity_type_ids,
      entity_id,
    } = queryParams

    let filters = ""

    if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.TEMPLATE
    ) {
      filters += " AND dt.dmm_parent_id in {material_ids:Array(Int64)}"
    } else if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.VARIANT
    ) {
      filters +=
        " AND dt.transactions_master_material_id in {material_ids:Array(Int64)}"
    }

    if (material_type_ids && material_type_ids.length > 0) {
      filters += " AND dt.material_type_id IN {material_type_ids:Array(Int64)}"
    }

    if (activity_ids && activity_ids.length > 0) {
      filters +=
        " AND dt.transactions_activity_id IN {activity_ids:Array(Int64)}"
    }

    if (entity_tag_ids && entity_tag_ids.length > 0) {
      filters += " AND dt.entity_tags_id IN {entity_tag_ids:Array(Int64)}"
    }

    if (entity_type_ids && entity_type_ids.length > 0) {
      filters += " AND dt.entities_type IN {entity_type_ids:Array(Int64)}"
    }

    if (entity_id) {
      filters += " AND dt.entities_id = {entity_id:Int64}"
    }

    if (province_id) {
      filters += " AND dt.entities_province_id = {province_id:Int64}"
    }

    if (regency_id) {
      filters += " AND dt.entities_regency_id = {regency_id:Int64}"
    }

    return filters
  }

  /**
   * Since availability = normal / min / max we can then also assume that availability != zero,
   * For 'normal' type, tracks recovery duration from 'zero' to first 'normal' state
   * @param transactionType: Transaction type of stock inventory
   * @returns
   */
  #valueCondition(transactionType: TransactionType) {
    let middleDurationCondition = ""
    let middleFrequencyCondition = ""
    let openingOffsetDurationCondition = ""
    let closingOffsetDurationCondition = ""
    let closingOffsetFrequencyCondition = ""
    let openingOffsetFrequencyCondition = ""

    if (transactionType == STOCK_INVENTORY_TRANSACTION_TYPE.AVAILABILITY) {
      // availability = normal / min / max or availability != zero
      middleDurationCondition = `
        current_stock_condition != 'zero'
      `
      middleFrequencyCondition = `
        current_stock_condition != 'zero'
        AND previous_stock_condition == 'zero'
        AND dateDiff('second', transactions_created_at, next_transaction_time) > 86400
      `
      openingOffsetDurationCondition = `
        opening_previous_stock_condition != 'zero'
      `
      openingOffsetFrequencyCondition = `
        opening_previous_stock_condition != 'zero'
        and opening_offset_duration > 86400
      `
      closingOffsetDurationCondition = `
        closing_current_stock_condition != 'zero'
      `
      closingOffsetFrequencyCondition = `
        closing_current_stock_condition != 'zero'
        and closing_previous_stock_condition == 'zero'
        and closing_offset_duration > 86400
      `
    } else if (transactionType == STOCK_INVENTORY_TRANSACTION_TYPE.NORMAL) {
      // For 'normal': track recovery from 'zero' to first 'normal'
      // This tracks the duration and frequency of stock recovery periods
      middleDurationCondition = `
        recovery_in_progress == 1
      `
      middleFrequencyCondition = `
        current_stock_condition == 'normal'
        AND recovery_start_flag == 1
      `
      openingOffsetDurationCondition = `
        opening_previous_stock_condition == 'zero'
        AND has_normal_in_period == 1
      `
      openingOffsetFrequencyCondition = `
        opening_previous_stock_condition == 'zero'
        AND has_normal_in_period == 1
      `
      closingOffsetDurationCondition = `
        closing_recovery_in_progress == 1
        AND has_normal_in_period == 1
      `
      closingOffsetFrequencyCondition = `
        closing_current_stock_condition == 'normal'
        AND closing_recovery_start_flag == 1
        AND has_normal_in_period == 1
      `
    } else {
      middleDurationCondition = `
        current_stock_condition == '${transactionType}'
      `
      middleFrequencyCondition = `
        current_stock_condition == '${transactionType}'
        AND previous_stock_condition != '${transactionType}'
        AND dateDiff('second', transactions_created_at, next_transaction_time) > 86400
      `
      openingOffsetDurationCondition = `
        opening_previous_stock_condition == '${transactionType}'
      `
      openingOffsetFrequencyCondition = `
        opening_previous_stock_condition == '${transactionType}'
        and opening_offset_duration > 86400
      `
      closingOffsetDurationCondition = `
        closing_current_stock_condition == '${transactionType}'
      `
      closingOffsetFrequencyCondition = `
        closing_current_stock_condition == '${transactionType}'
        and closing_previous_stock_condition != '${transactionType}'
        and closing_offset_duration > 86400
      `
    }

    return {
      middleDurationCondition,
      middleFrequencyCondition,
      openingOffsetDurationCondition,
      openingOffsetFrequencyCondition,
      closingOffsetDurationCondition,
      closingOffsetFrequencyCondition,
    }
  }

  /**
   * Build unified stock inventory query for both stock-availability and abnormal-stock
   * @param c - Hono context
   * @param queryParams - Query parameters
   * @param transactionType - Transaction type to filter by ('available', 'zero', 'min', 'max')
   */
  buildStockInventoryQuery(
    c: Context,
    queryParams: StockInventoryBaseQueryParams,
    transactionType: TransactionType
  ): string {
    const {
      period = "month",
      province_id,
      regency_id,
      entity_id,
      entity_tag_ids,
    } = queryParams

    const {
      middleDurationCondition,
      middleFrequencyCondition,
      openingOffsetDurationCondition,
      openingOffsetFrequencyCondition,
      closingOffsetDurationCondition,
      closingOffsetFrequencyCondition,
    } = this.#valueCondition(transactionType)

    const programId = c.var.programId ?? queryParams.program_id

    const filters = this.#buildFilters(queryParams)

    // Determine period format based on period type
    let periodFormat = "'%Y-%m'"
    let openingOffsetTime = "toStartOfMonth(first_transaction_time)"
    let closingOffsetTime =
      "toDateTime(formatDateTime(toLastDayOfMonth(last_transaction_time), '%Y-%m-%d 23:59:59'))"

    if (period === "day") {
      periodFormat = "'%Y-%m-%d'"
      openingOffsetTime = "toStartOfDay(first_transaction_time)"
      closingOffsetTime =
        "toDateTime(formatDateTime(toStartOfDay(last_transaction_time) + INTERVAL 1 DAY - INTERVAL 1 SECOND, '%Y-%m-%d 23:59:59'))"
    } else if (period === "week") {
      periodFormat = "'%G-%V'"
      openingOffsetTime = "toStartOfWeek(first_transaction_time)"
      closingOffsetTime =
        "toDateTime(formatDateTime(toStartOfWeek(last_transaction_time) + INTERVAL 6 DAY, '%Y-%m-%d 23:59:59'))"
    }

    const materialSelect =
      queryParams.material_level_id === KFA_LEVEL_CODE.TEMPLATE
        ? "dt.dmm_parent_id as master_material_id,"
        : "dt.transactions_master_material_id as master_material_id,"

    const balanceSelect =
      queryParams.material_level_id === KFA_LEVEL_CODE.TEMPLATE
        ? `
          dt.balance_per_entity_parent_materials AS current_balance,
          dt.balance_per_entity_parent_materials - dt.transactions_change_qty AS previous_balance,
        `
        : `
          dt.balance_per_entity_master_materials AS current_balance,
          dt.balance_per_entity_master_materials - dt.transactions_change_qty AS previous_balance,
        `

    // Build location selection based on hierarchical logic
    let locationSelect = ""
    if (entity_id || entity_tag_ids || (province_id && regency_id)) {
      // Both province and regency specified or entity specified - group by entity
      locationSelect = `
      dt.entities_id as location_id,`
    } else if (province_id && !regency_id) {
      // Only province specified - group by regency
      locationSelect = `
      dt.entities_regency_id as location_id,`
    } else {
      // No geographic filters - group by province
      locationSelect = `
      dt.entities_province_id as location_id,`
    }

    // Determine if we need recovery tracking CTEs
    const isNormalType =
      transactionType === STOCK_INVENTORY_TRANSACTION_TYPE.NORMAL

    // Build recovery CTEs only for 'normal' transaction type
    const recoveryCTEs = isNormalType
      ? `
        transactions_with_recovery_base AS (
          SELECT
            *,
            -- Track cumulative count of 'normal' states reached so far (excluding current row)
            coalesce(
              sumIf(1, current_stock_condition == 'normal') OVER (
                PARTITION BY master_material_id, entity_id, period
                ORDER BY transactions_id ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ) AS normal_count_before,
            -- Track cumulative count of 'zero' entries so far (excluding current row)
            coalesce(
              sumIf(1, previous_stock_condition != 'zero' AND current_stock_condition == 'zero') OVER (
                PARTITION BY master_material_id, entity_id, period
                ORDER BY transactions_id ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            ) AS zero_entry_count_before
          FROM transactions_with_state
        ),
        transactions_with_recovery AS (
          SELECT
            *,
            -- Increment recovery group only when:
            -- 1. Entering 'zero' state (previous != 'zero', current == 'zero')
            -- 2. AND we've reached 'normal' since the last zero entry (normal_count >= zero_entry_count)
            sumIf(
              1,
              previous_stock_condition != 'zero'
              AND current_stock_condition == 'zero'
              AND normal_count_before >= zero_entry_count_before
            ) OVER (
              PARTITION BY master_material_id, entity_id, period
              ORDER BY transactions_id ASC
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS recovery_group
          FROM transactions_with_recovery_base
        ),
        transactions_with_recovery_flags AS (
          SELECT
            *,
            -- Find the first 'normal' in each recovery group (immediate normal after zero)
            minIf(transactions_id, current_stock_condition == 'normal') OVER (
              PARTITION BY master_material_id, entity_id, period, recovery_group
            ) AS recovery_end_txn_id,
            -- Find the first 'zero' that started this recovery group
            minIf(transactions_id, current_stock_condition == 'zero') OVER (
              PARTITION BY master_material_id, entity_id, period, recovery_group
            ) AS recovery_start_txn_id,
            -- Flag: this is the first 'normal' in this recovery group
            if(
              current_stock_condition == 'normal' AND
              recovery_group > 0 AND
              transactions_id == minIf(transactions_id, current_stock_condition == 'normal') OVER (
                PARTITION BY master_material_id, entity_id, period, recovery_group
              ),
              1,
              0
            ) AS recovery_start_flag,
            -- Flag: recovery is in progress (from first zero in group to first normal in group)
            if(
              recovery_group > 0 AND
              recovery_start_txn_id > 0 AND
              recovery_end_txn_id > 0 AND
              transactions_id >= recovery_start_txn_id AND
              transactions_id <= recovery_end_txn_id,
              1,
              0
            ) AS recovery_in_progress
          FROM transactions_with_recovery
        ),`
      : ""

    // Source table for aggregation depends on transaction type
    const aggregationSource = isNormalType
      ? "transactions_with_recovery_flags"
      : "transactions_with_state"

    // Additional fields for normal type
    const normalTypeFields = isNormalType
      ? `
        argMax(recovery_in_progress, transactions_id) AS closing_recovery_in_progress,
        argMax(recovery_start_flag, transactions_id) AS closing_recovery_start_flag,`
      : ""

    // Build the main query
    const baseQuery = `
      WITH
        toDateTime({from:DateTime('Asia/Jakarta')}) AS date_start_spec,
        toDateTime({to:DateTime('Asia/Jakarta')}) AS date_end_spec,
        transactions_joined AS (
          SELECT
            dt.transactions_id,
            ${materialSelect}
            toInt64(dt.entities_province_id) AS province_id,
            toInt64(dt.entities_regency_id) AS regency_id,
            dt.entities_id AS entity_id,
            ${locationSelect}
            formatDateTime(dt.transactions_created_at + interval 7 hour, ${periodFormat}) AS period,
            dt.transactions_created_at + interval 7 hour as transactions_created_at,
            dt.transactions_change_qty,
            ${balanceSelect}
            dt.ema_min AS sum_emma_min,
            dt.ema_max AS sum_emma_max
          FROM datamart_stock_availability_v5 dt FINAL
          PREWHERE
            dt.program_id = ${programId}
            AND dt.entities_is_vendor = ${ENTITY_IS_VENDOR.IS_VENDOR}
            AND dt.entities_type != ${ENTITY_TYPE.CENTER}
            AND dt.entities_status = ${ENTITY_STATUS.ACTIVE}
          WHERE
            dt.transactions_created_at BETWEEN date_start_spec AND date_end_spec
            ${filters}
            AND dt.join_date IS NOT NULL
            AND (
              (dt.join_date <= toDate({to:DateTime('Asia/Jakarta')}) AND dt.end_date >= toDate({to:DateTime('Asia/Jakarta')}))
              OR
              (dt.end_date IS NULL AND dt.join_date <= toDate({to:DateTime('Asia/Jakarta')}))
            )
        ),
        transactions_with_state AS (
          SELECT
            *,
            multiIf(
              previous_balance <= 0, 'zero',
              previous_balance > 0 AND previous_balance < sum_emma_min, 'min',
              previous_balance > 0 AND previous_balance > sum_emma_max AND sum_emma_max > 0, 'max',
              previous_balance > 0 AND sum_emma_min > 0 AND sum_emma_max > 0 AND previous_balance >= sum_emma_min AND previous_balance <= sum_emma_max, 'normal',
              previous_balance > 0 AND sum_emma_min = 0 AND sum_emma_max = 0, 'normal',
              previous_balance > 0, 'available',
              ''
            ) AS previous_stock_condition,
            multiIf(
              current_balance <= 0, 'zero',
              current_balance > 0 AND current_balance < sum_emma_min, 'min',
              current_balance > 0 AND current_balance > sum_emma_max AND sum_emma_max > 0, 'max',
              current_balance > 0 AND sum_emma_min > 0 AND sum_emma_max > 0 AND current_balance >= sum_emma_min AND current_balance <= sum_emma_max, 'normal',
              current_balance > 0 AND sum_emma_min = 0 AND sum_emma_max = 0, 'normal',
              current_balance > 0, 'available',
              ''
            ) AS current_stock_condition,
            leadInFrame(transactions_created_at, 1, transactions_created_at) OVER (
              PARTITION BY master_material_id, entity_id, period
              ORDER BY transactions_id ASC
              ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
            ) AS next_transaction_time
          FROM transactions_joined
        ),
        ${recoveryCTEs}
        aggregated_by_period AS (
          SELECT
            entity_id,
            master_material_id,
            province_id,
            regency_id,
            location_id,
            period,
            COALESCE(argMin(current_balance, transactions_id), 0) AS opening_ehmm_balance,
            COALESCE(argMin(transactions_change_qty, transactions_id), 0) AS opening_change_qty,
            COALESCE(argMin(sum_emma_min, transactions_id), 0) AS opening_ehmm_min,
            COALESCE(argMin(sum_emma_max, transactions_id), 0) AS opening_ehmm_max,
            COALESCE(argMax(current_balance, transactions_id), 0) AS closing_ehmm_balance,
            COALESCE(argMax(transactions_change_qty, transactions_id), 0) AS closing_change_qty,
            COALESCE(argMax(sum_emma_min, transactions_id), 0) AS closing_ehmm_min,
            COALESCE(argMax(sum_emma_max, transactions_id), 0) AS closing_ehmm_max,
            sumIf(
              dateDiff('second', transactions_created_at, next_transaction_time),
              ${middleDurationCondition}
            ) AS middle_ehmm_duration,
            countIf(
              ${middleFrequencyCondition}
            ) AS middle_ehmm_frequency,
            argMin(transactions_created_at, transactions_id) AS first_transaction_time,
            argMin(previous_stock_condition, transactions_id) AS opening_previous_stock_condition,
            argMin(current_stock_condition, transactions_id) AS opening_current_stock_condition,
            ${normalTypeFields}
            argMax(transactions_created_at, transactions_id) AS last_transaction_time,
            argMax(current_stock_condition, transactions_id) AS closing_current_stock_condition,
            argMax(previous_stock_condition, transactions_id) AS closing_previous_stock_condition,
            -- Track if any 'normal' state was reached in this period (for normal type validation)
            maxIf(1, current_stock_condition == 'normal') AS has_normal_in_period
          FROM ${aggregationSource}
          GROUP BY
            province_id,
            regency_id,
            entity_id,
            location_id,
            master_material_id,
            period
          ORDER BY
            entity_id,
            master_material_id,
            period
        )
      SELECT
        province_id,
        regency_id,
        entity_id,
        location_id,
        master_material_id,
        period,
        opening_ehmm_balance,
        opening_change_qty,
        opening_ehmm_min,
        opening_ehmm_max,
        opening_previous_stock_condition,
        opening_current_stock_condition,
        middle_ehmm_duration,
        middle_ehmm_frequency,
        closing_ehmm_balance,
        closing_change_qty,
        closing_ehmm_min,
        closing_ehmm_max,
        closing_previous_stock_condition,
        closing_current_stock_condition,
        if(
          ${openingOffsetDurationCondition},
          dateDiff('second', ${openingOffsetTime}, first_transaction_time),
          0
        ) AS opening_offset_duration,
        if(
          ${closingOffsetDurationCondition},
          dateDiff('second', last_transaction_time, ${closingOffsetTime}),
          0
        ) AS closing_offset_duration,
        coalesce(
          opening_offset_duration + middle_ehmm_duration + closing_offset_duration,
          0
        ) AS total_duration_seconds,
        if(
          ${openingOffsetFrequencyCondition},
          1,
          0
        ) AS opening_offset_frequency,
        if(
          ${closingOffsetFrequencyCondition},
          1,
          0
        ) AS closing_offset_frequency,
        coalesce(
          opening_offset_frequency + middle_ehmm_frequency + closing_offset_frequency,
          0
        ) AS total_frequency
      FROM aggregated_by_period
      ORDER BY
        entity_id,
        province_id,
        regency_id,
        location_id,
        master_material_id,
        period
    `

    return baseQuery
  }

  /**
   * Get last updated timestamp
   * Shared between both modules
   */
  getLastUpdatedQuery(): string {
    return `
      SELECT
        formatDateTime(max(dt.transactions_updated_at), '%Y-%m-%d') as last_updated
      FROM datamart_stock_availability_v5 dt
      WHERE dt.transactions_updated_at IS NOT NULL
    `
  }
}
