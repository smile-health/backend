-- raw_ws_transaction_reasons definition

CREATE TABLE raw_ws_transaction_reasons
(

    `id` Int64,

    `program_id` Int32,

    `title` Nullable(String),

    `transaction_type_id` Nullable(Int32),

    `is_other` Nullable(Int8),

    `is_purchase` Nullable(Int8),

    `created_by` Nullable(Int64),

    `updated_by` Nullable(Int64),

    `deleted_by` Nullable(Int64),

    `created_at` DateTime64(3),

    `updated_at` DateTime64(3),

    `deleted_at` Nullable(DateTime64(3)),

    `status` Int8,

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