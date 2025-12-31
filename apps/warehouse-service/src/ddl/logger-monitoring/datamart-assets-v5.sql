-- datamart_assets_v5 definition

CREATE TABLE datamart_assets_v5
(

    `id` Int64,

    `asset_model_name` Nullable(String),

    `serial_number` Nullable(String),

    `status` Nullable(Int8),

    `activity_status` Nullable(Int8),

    `alarm_status` Nullable(Int8),

    `alarm_type` Nullable(Int8),

    `alarm_updated_at` Nullable(DateTime64(3)),

    `lat` Nullable(String),

    `lng` Nullable(String),

    `working_status_id` Nullable(Int64),

    `working_status` Nullable(String),

    `type_id` Nullable(Int64),

    `model_id` Nullable(Int64),

    `asset_type_name` Nullable(String),

    `manufacture_id` Nullable(Int64),

    `manufacture_name` Nullable(String),

    `entity_id` Nullable(Int64),

    `entity_name` Nullable(String),

    `entity_type_id` Nullable(Int16),

    `entity_status` Nullable(Int8),

    `entity_tag_id` Nullable(Int64),

    `entity_tag_name` Nullable(String),

    `province_id` Nullable(Int64),

    `province_name` Nullable(String),

    `regency_id` Nullable(Int64),

    `regency_name` Nullable(String),

    `sub_district_id` Nullable(Int64),

    `sub_district_name` Nullable(String),

    `village_id` Nullable(Int64),

    `village_name` Nullable(String),

    `created_by` Nullable(Int64),

    `updated_by` Nullable(Int64),

    `created_at` DateTime64(3),

    `updated_at` DateTime64(3),

    `deleted_at` Nullable(DateTime64(3)),

    `power_available` Nullable(Int8),

    `power_updated_at` Nullable(DateTime64(3)),

    `ownership_qty` Nullable(Int32),

    `ownership_status` Nullable(Int32),

    `capacity_status_id` Nullable(UInt8),

    `budget_year` Nullable(Int32),

    `production_year` Nullable(Int32),

    `warranty_asset_vendor_id` Nullable(Int64),

    `calibration_asset_vendor_id` Nullable(Int64),

    `maintenance_asset_vendor_id` Nullable(Int64),

    `entity_is_vendor` Nullable(Int8),

    `asset_electricity_id` Nullable(Int64),

    `asset_electricity_name` Nullable(String),

    `entity_deleted_at` Nullable(DateTime64(3)),

    `entity_created_at` DateTime64(3),

    `asset_classifications_id` Array(Nullable(Int64)) DEFAULT [],

    `asset_classifications_name` Array(Nullable(String)),

    `rtmds_qty` Nullable(Int64),

    `child_type_id` Nullable(Int64),

    `asset_rtmd_id` Array(Nullable(Int64)) DEFAULT [],

    `asset_communication_provider_id` Array(Nullable(Int64)) DEFAULT [],

    `master_deleted_at` Nullable(DateTime64(3)),

    `ingested_at` DateTime DEFAULT formatDateTime(now(),
 '%Y-%m-%d %H:%i:%S',
 'Asia/Jakarta'),

    `version` UInt32 DEFAULT toUnixTimestamp(now())
)
ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{uuid}/{shard}',
 '{replica}',
 version)
ORDER BY id
SETTINGS index_granularity = 8192;