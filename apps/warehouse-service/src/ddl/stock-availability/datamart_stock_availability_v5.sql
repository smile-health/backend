-- bronze_layer_v5_staging.datamart_stock_availability_v5 source

CREATE VIEW bronze_layer_v5_staging.datamart_stock_availability_v5
(

    `transactions_id` Int64,

    `program_id` Int8,

    `transactions_transaction_type_id` Nullable(Int32),

    `transactions_order_id` Nullable(Int64),

    `transactions_customer_id` Nullable(Int64),

    `transactions_vendor_id` Nullable(Int64),

    `transactions_stock_id` Nullable(Int64),

    `transactions_master_material_id` Nullable(Int32),

    `transactions_activity_id` Nullable(Int32),

    `transactions_activity_name` LowCardinality(Nullable(String)),

    `transactions_created_at` DateTime,

    `transactions_updated_at` Nullable(DateTime),

    `transactions_transaction_reason_id` Nullable(Int64),

    `join_date` Nullable(Date),

    `end_date` Nullable(Date),

    `transactions_deleted_at` Nullable(DateTime64(3)),

    `transactions_change_qty` Nullable(Float64),

    `transactions_opening_qty` Nullable(Float64),

    `batches_id` Nullable(Int64),

    `batches_code` Nullable(String),

    `entities_id` Nullable(Int32),

    `entities_is_vendor` Nullable(Int32),

    `entities_status` Nullable(Int16),

    `entities_type` Nullable(Int32),

    `entities_name` Nullable(String),

    `entities_code` Nullable(String),

    `entities_province_id` Nullable(Int64),

    `entities_regency_id` Nullable(Int64),

    `entities_province_name` LowCardinality(Nullable(String)),

    `entities_regency_name` LowCardinality(Nullable(String)),

    `entities_entity_tag_id` Nullable(Int32),

    `entity_tags_id` Nullable(Int32),

    `entity_tags_title` LowCardinality(Nullable(String)),

    `stock_activity_id` Nullable(Int32),

    `stock_activity_name` LowCardinality(Nullable(String)),

    `dmm_name` Nullable(String),

    `dmm_unit_of_consumption_name` LowCardinality(Nullable(String)),

    `dmm_unit_of_distribution_name` LowCardinality(Nullable(String)),

    `dmm_parent_id` Nullable(Int32),

    `material_type_id` Nullable(Int32),

    `material_type_name` LowCardinality(Nullable(String)),

    `expired_date` Nullable(DateTime64(3)),

    `orders_order_type_id` Nullable(Int32),

    `orders_order_status_id` Nullable(Int32),

    `orders_delivery_number` Nullable(String),

    `manufacture_id` Nullable(Int64),

    `manufacture_name` LowCardinality(Nullable(String)),

    `orders_order_customer_id` Nullable(Int64),

    `orders_order_vendor_id` Nullable(Int64),

    `customer_name` Nullable(String),

    `customer_code` Nullable(String),

    `customer_regency_id` Nullable(Int64),

    `customer_regency_name` Nullable(String),

    `customer_province_id` Nullable(Int64),

    `customer_province_name` Nullable(String),

    `vendor_name` Nullable(String),

    `vendor_code` Nullable(String),

    `vendor_regency_id` Nullable(Int64),

    `vendor_regency_name` Nullable(String),

    `vendor_province_id` Nullable(Int64),

    `vendor_province_name` Nullable(String),

    `transactions_transaction_type_name` LowCardinality(Nullable(String)),

    `transactions_transaction_reason_name` LowCardinality(Nullable(String)),

    `created_by_name` Nullable(String),

    `master_deleted_at` Nullable(DateTime64(3)),

    `ingested_at` DateTime,

    `version` UInt32,

    `ema_min` Nullable(Float64),

    `ema_max` Nullable(Float64),

    `stock_availability_duration_seconds` Int64,

    `stock_availability_duration_per_day_seconds` Int64,

    `stock_availability_category` String,

    `balance_per_entity_master_materials` Nullable(Float64)
)
AS WITH stock_availabilty_extra_cols AS
    (
        SELECT
            transactions_id,

            program_id,

            transactions_created_at,

            ema_min,

            ema_max,

            age('second',
 lagInFrame(transactions_created_at,
 1,
 transactions_created_at) OVER (PARTITION BY transactions_stock_id ORDER BY transactions_id ASC),
 transactions_created_at) AS stock_availability_duration_seconds,

            age('second',
 greatest(lagInFrame(transactions_created_at,
 1) OVER (PARTITION BY transactions_stock_id ORDER BY transactions_id ASC),
 toStartOfDay(transactions_created_at)),
 transactions_created_at) + (age('second',
 transactions_created_at,
 least(leadInFrame(transactions_created_at,
 1,
 toStartOfDay(transactions_created_at) + toIntervalDay(1)) OVER (PARTITION BY transactions_stock_id ORDER BY transactions_id ASC),
 toStartOfDay(transactions_created_at) + toIntervalDay(1))) * if((transactions_opening_qty + transactions_change_qty) >= 0,
 1,
 -1)) AS stock_availability_duration_per_day_seconds,

            if(transactions_opening_qty > 0,
 'Durasi Ketersediaan Stok',
 'Durasi Ketidaktersediaan Stok') AS stock_availability_category,

            any(transactions_opening_qty) OVER (PARTITION BY entities_id,
 transactions_master_material_id ORDER BY transactions_id ASC) + sum(transactions_change_qty) OVER (PARTITION BY entities_id,
 transactions_master_material_id ORDER BY transactions_id ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS balance_per_entity_master_materials
        FROM bronze_layer_v5_staging.datamart_transactions_v5 AS dtv5
        FINAL
    )
SELECT
    dmtv5.*,

    saec.* EXCEPT (transactions_id,
 program_id,
 transactions_created_at)
FROM bronze_layer_v5_staging.datamart_monitoring_transactions_v5 AS dmtv5
FINAL
LEFT JOIN stock_availabilty_extra_cols AS saec USING (transactions_id,
 program_id,
 transactions_created_at);