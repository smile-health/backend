-- datamart_transactions_v5 definition

CREATE TABLE datamart_transactions_v5
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

    `master_deleted_at` Nullable(DateTime64(3)),

    `ingested_at` DateTime DEFAULT formatDateTime(now(),
 '%Y-%m-%d %H:%i:%S',
 'Asia/Jakarta'),

    `version` UInt32 DEFAULT toUnixTimestamp(now()),

    `ema_min` Nullable(Float64),

    `ema_max` Nullable(Float64),

    `dmm_hierarchy_code` Nullable(String),

    `dmm_code` Nullable(String),

    `entities_id_satu_sehat` Nullable(Int64)
)
ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{uuid}/{shard}',
 '{replica}',
 version)
ORDER BY (program_id,
 toDate(transactions_created_at + toIntervalHour(7)),
 transactions_id)
SETTINGS index_granularity = 8192;