-- bronze_layer_v5_staging.datamart_rutin_inventory_v5 source

CREATE VIEW bronze_layer_v5_staging.datamart_rutin_inventory_v5
(

    `transactions_id` Int64,

    `program_id` Int8,

    `transactions_master_material_id` Nullable(Int32),

    `transactions_activity_id` Nullable(Int32),

    `activity_id` Nullable(Int32),

    `material_type_id` Nullable(Int32),

    `entities_tag_id` Nullable(Int32),

    `customer_entity_tag_id` Nullable(Int32),

    `vendor_entity_tag_id` Nullable(Int32),

    `entities_province_id` Nullable(Int64),

    `customer_province_id` Nullable(Int64),

    `vendor_province_id` Nullable(Int64),

    `entities_regency_id` Nullable(Int64),

    `customer_regency_id` Nullable(Int64),

    `vendor_regency_id` Nullable(Int64),

    `entities_id` Nullable(Int32),

    `transactions_created_at` DateTime,

    `entity_master_material_activities_id` Nullable(Int64),

    `ema_min` Nullable(Float64),

    `ema_max` Nullable(Float64),

    `entities_type` Nullable(Int32),

    `entities_join_date` Nullable(Date),

    `version` UInt32,

    `transactions_round_balance_qty` Nullable(Float64),

    `status` String
)
AS SELECT
    core.*,

    balance.balance_per_entity_master_materials AS transactions_round_balance_qty,

    multiIf(balance.balance_per_entity_master_materials = 0,
 'Habis',
 ((balance.balance_per_entity_master_materials != 0) AND (core.ema_max = 0) AND (core.ema_min = 0)) OR ((balance.balance_per_entity_master_materials >= core.ema_min) AND (balance.balance_per_entity_master_materials <= core.ema_max) AND (balance.balance_per_entity_master_materials != 0)),
 'Normal',
 (core.ema_max != 0) AND (core.ema_min != 0) AND (balance.balance_per_entity_master_materials > core.ema_max),
 '> Max',
 (core.ema_max != 0) AND (core.ema_min != 0) AND (balance.balance_per_entity_master_materials < core.ema_min),
 '< min',
 'Habis') AS status
FROM bronze_layer_v5_staging.dim_rutin_inventory AS core
FINAL
LEFT JOIN bronze_layer_v5_staging.datamart_stock_availability_v5 AS balance
FINAL ON core.transactions_id = balance.transactions_id;