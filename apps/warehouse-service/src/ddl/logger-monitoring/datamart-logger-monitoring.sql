-- datamart_logger_monitoring definition

CREATE TABLE datamart_logger_monitoring
(

    `asset_rtmd_id` Int64,

    `entity_id` Nullable(Int64),

    `logger_date` Nullable(Date),

    `week` Nullable(UInt8),

    `month` Nullable(UInt8),

    `year` Nullable(UInt16),

    `min_datetime` Nullable(DateTime64(3)),

    `max_datetime` Nullable(DateTime64(3)),

    `daily_data_sent` UInt64,

    `entity_name` Nullable(String),

    `entity_tag_id` Nullable(Int64),

    `data_per_hour` Float64,

    `hour_online` Nullable(Float64),

    `hour_offline` Nullable(Float64),

    `asset_rtmd_serial_number` Nullable(String),

    `asset_inventory_id` Nullable(Int64),

    `asset_inventory_serial_number` Nullable(String),

    `asset_inventory_production_year` Nullable(Int32),

    `asset_inventory_budget_year` Nullable(Int32),

    `asset_inventory_model_id` Nullable(Int64),

    `asset_inventory_type_id` Nullable(Int64),

    `asset_inventory_manufacture_id` Nullable(Int64),

    `asset_inventory_entity_id` Nullable(Int64),

    `asset_inventory_status` Nullable(Int8),

    `asset_inventory_working_status_id` Nullable(Int64),

    `asset_inventory_asset_type_name` Nullable(String),

    `asset_inventory_manufacture_name` Nullable(String),

    `asset_inventory_entity_is_vendor` Nullable(Int8),

    `asset_rtmd_type_id` Nullable(Int64),

    `asset_rtmd_type_name` String,

    `asset_rtmd_min_temperature` Nullable(Float64),

    `asset_rtmd_max_temperature` Nullable(Float64),

    `asset_rtmd_model_name` String,

    `asset_inventory_model_name` Nullable(String),

    `asset_classifications_id` Array(Int64),

    `manufacture_name` String,

    `asset_rtmd_vendor_name` String,

    `entity_type` Int16,

    `province_id` Nullable(String),

    `province_name` String,

    `regency_id` Nullable(String),

    `regency_name` String,

    `sub_district_id` Nullable(String),

    `sub_district_name` String,

    `village_id` Nullable(String),

    `village_name` String,

    `category_hour_offline` Nullable(String),

    `weekly_offline_category` Nullable(String),

    `excursion_type` Nullable(String),

    `freq_excursion_over_8` UInt64,

    `duration_excursion_over_8` Float64,

    `freq_excursion_over_8_below_1_hour` UInt64,

    `duration_excursion_over_8_below_1_hour` Float64,

    `freq_excursion_over_8_between_1_until_10_hour` UInt64,

    `duration_excursion_over_8_between_1_until_10_hour` Float64,

    `freq_excursion_over_8_over_10_hour` UInt64,

    `duration_excursion_over_8_over_10_hour` Float64,

    `freq_excursion_between_2_min_0_5` UInt64,

    `duration_excursion_between_2_min_0_5` Float64,

    `freq_excursion_between_2_min_0_5_below_1_hour` UInt64,

    `duration_excursion_between_2_min_0_5_below_1_hour` Float64,

    `freq_excursion_between_2_min_0_5_between_1_until_10_hour` UInt64,

    `duration_excursion_between_2_min_0_5_between_1_until_10_hour` Float64,

    `freq_excursion_between_2_min_0_5_over_10_hour` UInt64,

    `duration_excursion_between_2_min_0_5_over_10_hour` Float64,

    `freq_excursion_below_min_0_5` UInt64,

    `duration_excursion_below_min_0_5` Float64,

    `freq_excursion_below_min_0_5_below_1_hour` UInt64,

    `duration_excursion_below_min_0_5_below_1_hour` Float64,

    `freq_excursion_below_min_0_5_between_1_until_10_hour` UInt64,

    `duration_excursion_below_min_0_5_between_1_until_10_hour` Float64,

    `freq_excursion_below_min_0_5_over_10_hour` UInt64,

    `duration_excursion_below_min_0_5_over_10_hour` Float64,

    `freq_excursion_over_min_15` UInt64,

    `duration_excursion_over_min_15` Float64,

    `freq_excursion_over_min_15_below_1_hour` UInt64,

    `duration_excursion_over_min_15_below_1_hour` Float64,

    `freq_excursion_over_min_15_between_1_until_10_hour` UInt64,

    `duration_excursion_over_min_15_between_1_until_10_hour` Float64,

    `freq_excursion_over_min_15_over_10_hour` UInt64,

    `duration_excursion_over_min_15_over_10_hour` Float64,

    `freq_excursion_over_min_0_5` UInt64,

    `duration_excursion_over_min_0_5` Float64,

    `freq_excursion_over_min_0_5_below_1_hour` UInt64,

    `duration_excursion_over_min_0_5_below_1_hour` Float64,

    `freq_excursion_over_min_0_5_between_1_until_10_hour` UInt64,

    `duration_excursion_over_min_0_5_between_1_until_10_hour` Float64,

    `freq_excursion_over_min_0_5_over_10_hour` UInt64,

    `duration_excursion_over_min_0_5_over_10_hour` Float64,

    `freq_excursion_below_min_2` UInt64,

    `duration_excursion_below_min_2` Float64,

    `freq_excursion_below_min_2_below_1_hour` UInt64,

    `duration_excursion_below_min_2_below_1_hour` Float64,

    `freq_excursion_below_min_2_between_1_until_10_hour` UInt64,

    `duration_excursion_below_min_2_between_1_until_10_hour` Float64,

    `freq_excursion_below_min_2_over_10_hour` UInt64,

    `duration_excursion_below_min_2_over_10_hour` Float64,

    `latest_status_excursion` String,

    `updated_at` DateTime64(3),

    `ingested_at` DateTime,

    `version` UInt32,

    `asset_rtmd_deleted_at` Nullable(DateTime64(3)),

    `asset_inventory_deleted_at` Nullable(DateTime64(3)),

    `is_online_today` UInt8
)
ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{uuid}/{shard}',
 '{replica}')
ORDER BY (asset_rtmd_id,
 entity_id,
 logger_date)
SETTINGS allow_nullable_key = 1,
 replicated_deduplication_window = 0,
 index_granularity = 8192;