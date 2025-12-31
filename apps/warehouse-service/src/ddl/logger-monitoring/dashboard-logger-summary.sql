-- dashboard_logger_summary definition

CREATE TABLE dashboard_logger_summary
(

    `entity_id` Int64,

    `logger_date` Date,

    `asset_rtmd_id` Nullable(Int64),

    `province_id` Nullable(String),

    `province_name` Nullable(String),

    `regency_id` Nullable(String),

    `regency_name` Nullable(String),

    `week` Int16,

    `month` Nullable(Int16),

    `year` Nullable(Int16),

    `day_of_week` Nullable(Int8),

    `logger_active_on_smile` Int64 DEFAULT 0,

    `logger_releted_at_cce` Int64 DEFAULT 0,

    `logger_not_releted_at_cce` Int64 DEFAULT 0,

    `logger_that_send_data` Int64 DEFAULT 0,

    `logger_online_twenty_four_hours` Int64 DEFAULT 0,

    `logger_was_once_offline` Int64 DEFAULT 0,

    `logger_offline_under_one_hours` Int64 DEFAULT 0,

    `logger_offline_one_until_ten_hours` Int64 DEFAULT 0,

    `logger_offline_over_ten_hours` Int64 DEFAULT 0,

    `facilities_with_reported_excursion_incident` Int64 DEFAULT 0,

    `facilities_with_no_reported_excursion_incident` Int64 DEFAULT 0,

    `facilities_with_reported_low_temperature_excursion` Int64 DEFAULT 0,

    `facilities_with_reported_high_temperature_excursion` Int64 DEFAULT 0,

    `freq_facility_excursion_over_8_cce` Int64 DEFAULT 0,

    `freq_facility_excursion_between_2_min_0_5_cce` Int64 DEFAULT 0,

    `freq_facility_excursion_below_min_0_5_cce` Int64 DEFAULT 0,

    `freq_facility_excursion_over_min_15_cce` Int64 DEFAULT 0,

    `freq_facility_excursion_over_min_0_5_cce` Int64 DEFAULT 0,

    `freq_facility_excursion_below_2_cce` Int64 DEFAULT 0,

    `freq_excursion_over_8_cce_cat_1` Int64 DEFAULT 0,

    `freq_excursion_over_8_cce_cat_2` Int64 DEFAULT 0,

    `freq_excursion_over_8_cce_cat_3` Int64 DEFAULT 0,

    `freq_excursion_between_2_min_0_5_cce_cat_1` Int64 DEFAULT 0,

    `freq_excursion_between_2_min_0_5_cce_cat_2` Int64 DEFAULT 0,

    `freq_excursion_between_2_min_0_5_cce_cat_3` Int64 DEFAULT 0,

    `freq_excursion_below_min_0_5_cce_cat_1` Int64 DEFAULT 0,

    `freq_excursion_below_min_0_5_cce_cat_2` Int64 DEFAULT 0,

    `freq_excursion_below_min_0_5_cce_cat_3` Int64 DEFAULT 0,

    `freq_excursion_over_min_15_cce_cat_1` Int64 DEFAULT 0,

    `freq_excursion_over_min_15_cce_cat_2` Int64 DEFAULT 0,

    `freq_excursion_over_min_15_cce_cat_3` Int64 DEFAULT 0,

    `freq_excursion_over_min_0_5_cce_cat_1` Int64 DEFAULT 0,

    `freq_excursion_over_min_0_5_cce_cat_2` Int64 DEFAULT 0,

    `freq_excursion_over_min_0_5_cce_cat_3` Int64 DEFAULT 0,

    `freq_excursion_over_8_sum` Int64 DEFAULT 0,

    `freq_excursion_over_8_sum_cat_1` Int64 DEFAULT 0,

    `freq_excursion_over_8_sum_cat_2` Int64 DEFAULT 0,

    `freq_excursion_over_8_sum_cat_3` Int64 DEFAULT 0,

    `freq_excursion_between_2_min_0_5_sum` Int64 DEFAULT 0,

    `freq_excursion_between_2_min_0_5_sum_cat_1` Int64 DEFAULT 0,

    `freq_excursion_between_2_min_0_5_sum_cat_2` Int64 DEFAULT 0,

    `freq_excursion_between_2_min_0_5_sum_cat_3` Int64 DEFAULT 0,

    `freq_excursion_below_min_0_5_sum` Int64 DEFAULT 0,

    `freq_excursion_below_min_0_5_sum_cat_1` Int64 DEFAULT 0,

    `freq_excursion_below_min_0_5_sum_cat_2` Int64 DEFAULT 0,

    `freq_excursion_below_min_0_5_sum_cat_3` Int64 DEFAULT 0,

    `freq_excursion_over_min_15_sum` Int64 DEFAULT 0,

    `freq_excursion_over_min_15_sum_cat_1` Int64 DEFAULT 0,

    `freq_excursion_over_min_15_sum_cat_2` Int64 DEFAULT 0,

    `freq_excursion_over_min_15_sum_cat_3` Int64 DEFAULT 0,

    `freq_excursion_over_min_0_5_sum` Int64 DEFAULT 0,

    `freq_excursion_over_min_0_5_sum_cat_1` Int64 DEFAULT 0,

    `freq_excursion_over_min_0_5_sum_cat_2` Int64 DEFAULT 0,

    `freq_excursion_over_min_0_5_sum_cat_3` Int64 DEFAULT 0,

    `ingested_at` DateTime DEFAULT formatDateTime(now(),
 '%Y-%m-%d %H:%i:%S',
 'Asia/Jakarta'),

    `version` Int32 DEFAULT toUnixTimestamp(now())
)
ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{uuid}/{shard}',
 '{replica}',
 version)
ORDER BY (entity_id,
 logger_date,
 week)
SETTINGS index_granularity = 8192;