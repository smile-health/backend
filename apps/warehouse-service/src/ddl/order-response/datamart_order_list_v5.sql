-- bronze_layer_v5_staging.datamart_order_list_v5 definition

CREATE TABLE bronze_layer_v5_staging.datamart_order_list_v5
(

    `order_id` Int64,

    `program_id` Int32,

    `device_type` Nullable(Int16),

    `status_id` Int32,

    `status_name` Nullable(String),

    `type_id` Int32,

    `delivery_type_id` Nullable(Int32),

    `type_name` Nullable(String),

    `order_created_at` DateTime64(3),

    `order_updated_at` DateTime64(3),

    `total_order_items` Nullable(Int32),

    `user_created_by` Nullable(Int64),

    `created_by_name` Nullable(String),

    `vendor_id` Int64,

    `vendor_name` Nullable(String),

    `vendor_entity_tag_id` Nullable(Int64),

    `vendor_province_name` String,

    `vendor_regency_name` String,

    `vendor_status` Nullable(Int8),

    `vendor_type` Nullable(Int16),

    `customer_id` Int64,

    `customer_name` Nullable(String),

    `customer_entity_tag_id` Nullable(Int64),

    `customer_province_name` String,

    `customer_regency_name` String,

    `customer_status` Nullable(Int8),

    `customer_type` Nullable(Int16),

    `activity_id` Int64,

    `activity_name` String,

    `confirmed_by` Nullable(Int32),

    `shipped_by` Nullable(Int32),

    `fulfilled_by` Nullable(Int32),

    `cancelled_by` Nullable(Int32),

    `allocated_by` Nullable(Int32),

    `confirmed_at` Nullable(DateTime64(3)),

    `shipped_at` Nullable(DateTime64(3)),

    `fulfilled_at` Nullable(DateTime64(3)),

    `cancelled_at` Nullable(DateTime64(3)),

    `allocated_at` Nullable(DateTime64(3)),

    `delivery_type_name` String,

    `doc_no` Nullable(String),

    `notes` Nullable(String),

    `po_no` Nullable(String),

    `is_allocated` Nullable(Int8),

    `delivery_number` Nullable(String),

    `purchase_ref` Nullable(String),

    `sales_ref` Nullable(String),

    `metadata` Nullable(String),

    `released_date` Nullable(DateTime64(3)),

    `ingested_at` DateTime DEFAULT formatDateTime(now(),
 '%Y-%m-%d %H:%i:%S',
 'Asia/Jakarta'),

    `version` UInt32 DEFAULT toUnixTimestamp(now()),

    `vendor_province_id` Int64,

    `vendor_regency_id` Int64,

    `customer_province_id` Int64,

    `customer_regency_id` Int64,

    `deleted_at` Nullable(DateTime64(3)),

    `master_deleted_at` Nullable(DateTime64(3)),

    `vendor_sub_district_id` Nullable(String),

    `customer_sub_district_id` Nullable(String),

    `duration_shipped_to_received` Nullable(Int32),

    `duration_allocation_to_shipped` Nullable(Int32),

    `duration_order_to_allocation` Nullable(Int32),

    `material_id` Array(Nullable(Int64)) DEFAULT [],

    `parent_material_id` Array(Nullable(Int64)) DEFAULT [],

    `material_name` Array(Nullable(String)),

    `entity_activity_start_date` Nullable(DateTime64(3)),

    `entity_activity_end_date` Nullable(DateTime64(3))
)
ENGINE = ReplicatedReplacingMergeTree('/clickhouse/tables/{uuid}/{shard}',
 '{replica}',
 version)
PRIMARY KEY (program_id,
 order_created_at,
 order_id)
ORDER BY (program_id,
 order_created_at,
 order_id)
SETTINGS index_granularity = 8192;