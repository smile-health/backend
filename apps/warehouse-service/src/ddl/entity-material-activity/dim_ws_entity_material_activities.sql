-- bronze_layer_v5_staging.dim_ws_entity_material_activities definition

CREATE TABLE bronze_layer_v5_staging.dim_ws_entity_material_activities
(

    `ema_id` Int64,

    `ema_entity_id` Int64,

    `ema_material_id` Int64,

    `ema_activity_id` Int64,

    `program_id` Int32,

    `ema_min` Nullable(Float64),

    `ema_max` Nullable(Float64),

    `ema_created_at` DateTime64(3),

    `ema_updated_at` DateTime64(3),

    `ema_deleted_at` Nullable(DateTime64(3)),

    `entity_name` Nullable(String),

    `entity_province_id` Nullable(String),

    `entity_province_name` Nullable(String),

    `entity_regency_id` Nullable(String),

    `entity_regency_name` Nullable(String),

    `entity_is_vendor` Nullable(Int8),

    `entity_deleted_at` Nullable(DateTime64(3)),

    `entity_status` Nullable(Int8),

    `entity_tag_id` Nullable(Int64),

    `entity_tag_title` Nullable(String),

    `entity_type` Nullable(Int16),

    `entity_activity_id` Int64,

    `entity_activity_start_date` Nullable(DateTime64(3)),

    `entity_activity_end_date` Nullable(DateTime64(3)),

    `material_name` Nullable(String),

    `material_type_id` Nullable(Int64),

    `material_is_stock_opname_mandatory` Nullable(Int8),

    `activity_name` Nullable(String),

    `has_transaction_already` Nullable(Int8),

    `master_updated_at` DateTime64(3),

    `ingested_at` DateTime,

    `version` UInt32
)
ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{uuid}/{shard}',
 '{replica}',
 version)
PRIMARY KEY (program_id,
 ema_activity_id,
 entity_activity_id,
 ema_id)
ORDER BY (program_id,
 ema_activity_id,
 entity_activity_id,
 ema_id)
SETTINGS index_granularity = 8192;