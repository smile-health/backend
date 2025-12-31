WITH
    toDateTime(${from:DateTime('Asia/Jakarta')}) AS date_start_spec,
    toDateTime(${to:DateTime('Asia/Jakarta')}) AS date_end_spec,
    transactions_joined AS (
        SELECT
          dt.transactions_id,
            -- dt.entity_has_master_materials_id AS ehmm_id,
          dt.transactions_master_material_id as master_material_id,
            toInt64(dt.entities_province_id) AS province_id,
            toInt64(dt.entities_regency_id) AS regency_id,
            dt.transactions_customer_id AS entity_id,
            formatDateTime(dt.transactions_created_at, '%Y-%m') AS period,
            dt.transactions_created_at,
            dt.transactions_change_qty,
            dt.balance_per_entity_master_materials AS current_balance,
            dt.balance_per_entity_master_materials - dt.transactions_change_qty AS previous_balance,
            SUM(dt.ema_min) OVER (PARTITION BY master_material_id, entity_id ) AS sum_emma_min,
            SUM(dt.ema_max) OVER (PARTITION BY master_material_id, entity_id ) AS sum_emma_max
        FROM datamart_stock_availabilty_v5 AS dt
        WHERE
            dt.transactions_created_at BETWEEN date_start_spec AND date_end_spec
            AND dt.entities_is_vendor = 1
            AND dt.entities_type != 5
            AND dt.transactions_vendor_id != 0 and dt.transactions_master_material_id != 0
            AND dt.transactions_vendor_id IS NOT NULL  and dt.transactions_master_material_id IS NOT NULL
            AND dt.transactions_master_material_id IN ${masterMaterialId:Array(Int64)}
            AND dt.entity_tags_id IN ${entityTags:Array(Int64)}
            AND dt.join_date IS NOT NULL
            AND dt.entities_province_id = ${provinceId:Int64}
            AND dt.entities_regency_id = ${regencyId:Int64}
            AND dt.entities_id = ${entityId:Int64}
     AND (
       (dt.join_date <= toDate(${currentDate:Date}) AND dt.end_date >= toDate(${currentDate:Date}))
       OR 
       (dt.end_date IS NULL AND dt.join_date <= toDate(${currentDate:Date}))
     )
    ),
    transactions_with_state AS (
        SELECT
            *,
            -- change case when to multi if
            multiIf(
                previous_balance <= 0, 'zero',
                previous_balance > 0 AND previous_balance < sum_emma_min, 'min',
                previous_balance > 0 AND previous_balance > sum_emma_max AND sum_emma_max > 0, 'max',
                previous_balance > 0 AND sum_emma_min > 0 AND sum_emma_max > 0 AND previous_balance >= sum_emma_min AND previous_balance <= sum_emma_max, 'normal',
                previous_balance > 0, 'available',
                ''
            ) AS previous_stock_condition,
            multiIf(
                current_balance <= 0, 'zero',
                current_balance > 0 AND current_balance < sum_emma_min, 'min',
                current_balance > 0 AND current_balance > sum_emma_max AND sum_emma_max > 0, 'max',
                current_balance > 0 AND sum_emma_min > 0 AND sum_emma_max > 0 AND current_balance >= sum_emma_min AND current_balance <= sum_emma_max, 'normal',
                current_balance > 0, 'available',
                ''
            ) AS current_stock_condition,
            -- Use a window function to get the timestamp of the next transaction
            leadInFrame(transactions_created_at, 1, transactions_created_at) OVER (PARTITION BY master_material_id, entity_id, period ORDER BY transactions_id ASC ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS next_transaction_time
        FROM transactions_joined
    ),
    aggregated_by_period AS (
        SELECT
            -- ehmm_id
            entity_id,
            master_material_id,
            province_id,
            regency_id,
            period,
            -- Get opening values using argMin
            COALESCE(argMin(current_balance, transactions_id),0) AS opening_ehmm_balance,
            COALESCE(argMin(transactions_change_qty, transactions_id),0) AS opening_change_qty,
            COALESCE(argMin(sum_emma_min, transactions_id),0) AS opening_ehmm_min,
            COALESCE(argMin(sum_emma_max, transactions_id),0) AS opening_ehmm_max,
            -- Get closing values using argMax
            COALESCE(argMax(current_balance, transactions_id),0) AS closing_ehmm_balance,
            COALESCE(argMax(transactions_change_qty, transactions_id),0) AS closing_change_qty,
            COALESCE(argMax(sum_emma_min, transactions_id),0) AS closing_ehmm_min,
            COALESCE(argMax(sum_emma_max, transactions_id),0) AS closing_ehmm_max,
            -- Calculate middle duration and frequency with conditional aggregation
            sumIf(
                dateDiff('second', transactions_created_at, next_transaction_time),
                isNotNull(next_transaction_time) AND current_stock_condition != 'zero'
            ) AS middle_ehmm_duration,
            countIf(
                isNotNull(next_transaction_time)
                AND current_stock_condition != 'zero'
                AND previous_stock_condition == 'zero'
                AND dateDiff('second', transactions_created_at, next_transaction_time) > 86400
            ) AS middle_ehmm_frequency,
            -- Get values needed for opening/closing offset calculations
            argMin(transactions_created_at, transactions_id) AS first_transaction_time,
            argMin(previous_stock_condition, transactions_id) AS opening_previous_stock_condition,
            argMax(transactions_created_at, transactions_id) AS last_transaction_time,
            argMax(current_stock_condition, transactions_id) AS closing_current_stock_condition,
            argMax(previous_stock_condition, transactions_id) AS closing_previous_stock_condition
        FROM transactions_with_state
        GROUP BY
            province_id,
            regency_id,
            entity_id,
            master_material_id,
            period
        ORDER BY
        entity_id,
        master_material_id,
        period
    )
SELECT
    -- ehmm_id,
    province_id,
    regency_id,
    entity_id,
    master_material_id,
    period,
    opening_ehmm_balance,
    opening_change_qty,
    opening_ehmm_min,
    opening_ehmm_max,
    closing_ehmm_balance,
    closing_change_qty,
    closing_ehmm_min,
    closing_ehmm_max,
    -- Calculate opening offset duration & frequency
    coalesce(
        if(
            opening_previous_stock_condition != 'zero',
            dateDiff('second', toStartOfMonth(first_transaction_time), first_transaction_time),
            0
        )
    + middle_ehmm_duration
    + 
        if(
            closing_current_stock_condition != 'zero',
            dateDiff('second', last_transaction_time, toDateTime(formatDateTime(toLastDayOfMonth(last_transaction_time), '%Y-%m-%d 23:59:59'))),
            0
        )
    , 0
    ) AS total_duration_seconds,
    -- Calculate closing offset duration & frequency
    coalesce(
        if(
            opening_previous_stock_condition != 'zero' AND dateDiff('second', toStartOfMonth(first_transaction_time), first_transaction_time) > 86400,
            1,
            0
        ), 0
    )
    + middle_ehmm_frequency
    + coalesce(
        if(
            closing_current_stock_condition != 'zero'
            AND closing_previous_stock_condition == 'zero'
            AND dateDiff('second', last_transaction_time, toDateTime(formatDateTime(toLastDayOfMonth(last_transaction_time), '%Y-%m-%d 23:59:59'))) > 86400,
            1,
            0
        ), 0 ) 
    AS total_frequency
FROM aggregated_by_period
ORDER BY
    entity_id,
    master_material_id,
    period;