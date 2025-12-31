-- dashboard_info_logger definition

CREATE TABLE dashboard_info_logger
(

    `primary_key_id` UUID,

    `province_name` Nullable(String),

    `regency_name` Nullable(String),

    `entity_id` Nullable(Int64),

    `entity_name` Nullable(String),

    `entity_type` Nullable(Int16),

    `id_coldstorage` Nullable(Int64),

    `type_coldstorage` Nullable(String),

    `model_coldstorage` Nullable(String),

    `manufacture_name_coldstorage` Nullable(String),

    `working_status_coldstorage` Nullable(Int64),

    `asset_type_id` Nullable(Int64),

    `lattitude` Nullable(String),

    `longitude` Nullable(String),

    `other_manufacture` Nullable(String),

    `id_logger` Nullable(Int64),

    `model_logger` Nullable(String),

    `asset_rtmd_serial_number` Nullable(String),

    `other_model_logger` Nullable(String),

    `asset_rtmd_vendor_name` Nullable(String),

    `asset_status_active` Nullable(Int8),

    `tahun_anggaran` Nullable(Int32),

    `sumber_anggaran` Nullable(String),

    `sumber_anggaran_lainnya` Nullable(String),

    `created_at` DateTime64(3),

    `updated_at` DateTime64(3),

    `status_pembacaan_suhu` Nullable(Int32),

    `version` UInt64 DEFAULT toUnixTimestamp(now())
)
ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{uuid}/{shard}',
 '{replica}',
 version)
ORDER BY primary_key_id
SETTINGS index_granularity = 8192;