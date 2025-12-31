-- bronze_layer_v5_staging.datamart_order_difference_v5 definition

CREATE TABLE bronze_layer_v5_staging.datamart_order_difference_v5
(

    `id` Int64,

    `order_id` Nullable(Int64),

    `order_status` Nullable(Int32),

    `order_type` Nullable(Int32),

    `entities_id` Nullable(Int64),

    `entity_province_id` Nullable(Int64),

    `entity_regency_id` Nullable(Int64),

    `entity_subdistrict_id` Nullable(Int32),

    `master_material_id` Nullable(Int32),

    `parent_material_id` Nullable(Int32),

    `activity_id` Int32,

    `program_id` Int32,

    `entity_tag_id` Nullable(Int64),

    `reason_id` Nullable(Int32),

    `reason` Nullable(String),

    `sent` Nullable(Float64),

    `received` Nullable(Float64),

    `ordered` Nullable(Float64),

    `recommended` Nullable(Float64),

    `created_at` DateTime64(3),

    `updated_at` Nullable(DateTime64(3)),

    `deleted_at` Nullable(DateTime64(3)),

    `master_deleted_at` Nullable(DateTime64(3)),

    `entity_name` Nullable(String),

    `entity_province_name` Nullable(String),

    `entity_regency_name` Nullable(String),

    `material_name` Nullable(String),

    `material_type_id` Nullable(Int64),

    `material_type` Nullable(String),

    `activity_name` Nullable(String),

    `entity_type` Nullable(Int32),

    `entity_status` Nullable(Int16),

    `entity_activity_start_date` Nullable(DateTime64(3)),

    `entity_activity_end_date` Nullable(DateTime64(3)),

    `ingested_at` DateTime DEFAULT formatDateTime(now(),
 '%Y-%m-%d %H:%i:%S',
 'Asia/Jakarta'),

    `version` UInt32 DEFAULT toUnixTimestamp(now())
)
ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{uuid}/{shard}',
 '{replica}',
 version)
PRIMARY KEY (id,
 activity_id,
 toDate(created_at + toIntervalHour(7)))
ORDER BY (id,
 activity_id,
 toDate(created_at + toIntervalHour(7)))
SETTINGS index_granularity = 8192;