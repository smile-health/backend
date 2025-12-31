-- bronze_layer_v5_staging.raw_integration_asik_aggregate definition

CREATE TABLE bronze_layer_v5_staging.raw_integration_asik_aggregate
(

    `id` Int32,

    `customer_id` Nullable(Int32),

    `pos_imunisasi_asik` Nullable(String),

    `vendor_id` Nullable(Int32),

    `puskesmas_asik` Nullable(String),

    `material_id` Nullable(Int32),

    `vaksin_asik` Nullable(String),

    `batch_number_asik` Nullable(String),

    `batch_id_smile` Nullable(Int32),

    `batch_code_smile` Nullable(String),

    `injection_date` Nullable(Date),

    `aggregate` Nullable(Int32),

    `input_date` Nullable(Date),

    `pos_imunisasi_asik_province_id` Nullable(Int32),

    `pos_imunisasi_asik_regency_id` Nullable(Int32),

    `pos_imunisasi_asik_subdistrict_id` Nullable(Int32),

    `puskesmas_asik_province_id` Nullable(Int32),

    `puskesmas_asik_regency_id` Nullable(Int32),

    `puskesmas_asik_subdistrict_id` Nullable(Int32),

    `page` Nullable(Int32),

    `created_at` DateTime64(3),

    `updated_at` DateTime64(3),

    `deleted_at` Nullable(DateTime64(3)),

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