CREATE TABLE mysql_ws_order_lists on cluster '{cluster}'
ENGINE = MySQL('mysql:3306', 'testdb', 'ws_order_lists', 'user', 'password');

CREATE TABLE ws_order_lists on cluster '{cluster}'
(
    `order_id` Int64,
    `device_type` Nullable(Int16),
    `status_id` Int32,
    `status_name` Nullable(String),
    `type_id` Int32,
    `delivery_type_id` Nullable(Int32),
    `type_name` Nullable(String),
    `order_created_at` DateTime,
    `order_updated_at` DateTime,
    `total_order_items` Nullable(Int32),
    `user_created_by` Nullable(Int64),
    `created_by_name` Nullable(String),
    `vendor_id` Int64,
    `vendor_name` Nullable(String),
    `vendor_entity_tag_id` Nullable(Int64),
    `vendor_province_name` Nullable(String),
    `vendor_regency_name` Nullable(String),
    `customer_id` Int64,
    `customer_name` Nullable(String),
    `customer_entity_tag_id` Nullable(Int64),
    `customer_province_name` Nullable(String),
    `customer_regency_name` Nullable(String),
    `activity_id` Int64,
    `activity_name` String,
    `program_id` Int32,
    `confirmed_by` Nullable(Int32),
    `shipped_by` Nullable(Int32),
    `fulfilled_by` Nullable(Int32),
    `cancelled_by` Nullable(Int32),
    `allocated_by` Nullable(Int32),
    `confirmed_at` Nullable(DateTime),
    `shipped_at` Nullable(DateTime),
    `fulfilled_at` Nullable(DateTime),
    `cancelled_at` Nullable(DateTime),
    `allocated_at` Nullable(DateTime),
    `delivery_type_name` Nullable(String),
    `doc_no` Nullable(String),
    `notes` Nullable(String),
    `po_no` Nullable(String),
    `is_allocated` Nullable(Int8),
    `delivery_number` Nullable(String),
    `purchase_ref` Nullable(String),
    `sales_ref` Nullable(String)
)
ENGINE = ReplacingMergeTree
ORDER BY order_id;

CREATE MATERIALIZED VIEW IF NOT EXISTS ws_order_lists_view on cluster '{cluster}'
REFRESH EVERY 30 SECONDS APPEND TO ws_order_lists AS
select * from mysql_ws_order_lists t
WHERE t.order_id > (SELECT max(order_id) FROM ws_order_lists)
AND t.order_id <= (SELECT max(order_id) FROM ws_order_lists) + 10000
ORDER BY t.order_id;
