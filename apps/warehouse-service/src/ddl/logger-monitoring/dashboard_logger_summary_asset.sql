-- dashboard_logger_summary_asset definition

CREATE TABLE dashboard_logger_summary_asset
(

    `province_id` Nullable(Int32),

    `province_name` Nullable(String),

    `regency_id` Int64,

    `regency_name` Nullable(String),

    `week` Int32,

    `month` Nullable(Int32),

    `year` Nullable(Int32),

    `period` Date,

    `cce_registered_with_smile` Nullable(Int64),

    `cce_functional_status` Nullable(Int64),

    `cce_broken_and_under_repair_status` Nullable(Int64),

    `cce_broken_and_need_repair_status` Nullable(Int64),

    `cce_broken_and_cannot_be_repaire_status` Nullable(Int64),

    `cce_functional_status_related_to_logger` Nullable(Int64),

    `logger_active_on_smile` Nullable(Int64),

    `logger_releted_at_cce` Nullable(Int64),

    `logger_not_releted_at_cce` Nullable(Int64),

    `version` UInt32 DEFAULT toUnixTimestamp(now())
)
ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{uuid}/{shard}',
 '{replica}',
 version)
ORDER BY (week,
 period,
 regency_id)
SETTINGS index_granularity = 8192;