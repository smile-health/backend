-- SMILE 3.0 to 5.0 Migration Count Comparison (Side-by-Side)
-- This SQL file provides count queries to compare source and target data in side-by-side format
-- Replace database prefixes with actual database names

-- =============================================================================
-- GLOBAL MIGRATIONS COUNT COMPARISON (SIDE-BY-SIDE)
-- =============================================================================

-- Location Migration (Multiple source tables to single target)
SELECT 
    1 as id,
    'Location Migration (Combined)' as table_name,
    (
        (SELECT COUNT(*) FROM prod_logistic_20250714.provinces WHERE deleted_at IS NULL) +
        (SELECT COUNT(*) FROM prod_logistic_20250714.regencies WHERE deleted_at IS NULL) +
        (SELECT COUNT(*) FROM prod_logistic_20250714.sub_districts WHERE deleted_at IS NULL AND id > '731002') +
        (SELECT COUNT(*) FROM prod_logistic_20250714.villages WHERE deleted_at IS NULL)
    ) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.locations) as target_count;

-- Activity Migration
SELECT 
    2 as id,
    'Activity Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.master_activities WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_activities) as target_count;

-- User Migration
SELECT 
    3 as id,
    'User Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.users WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.users) as target_count;

-- Entity Migration
SELECT 
    4 as id,
    'Entity Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.entities WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.entities) as target_count;

-- Material Migration
SELECT 
    5 as id,
    'Material Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.master_materials WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.materials) as target_count;

-- Manufacture Migration
SELECT 
    6 as id,
    'Manufacture Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.manufactures WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.manufactures) as target_count;

-- =============================================================================
-- WORKSPACE-SPECIFIC MIGRATIONS COUNT COMPARISON (SIDE-BY-SIDE)
-- =============================================================================

-- Patient Migration
SELECT 
    7 as id,
    'Patient Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.patients WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_patients) as target_count;

-- Stock Migration
SELECT 
    8 as id,
    'Stock Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.stocks) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_stocks) as target_count;

-- Batch Migration
SELECT 
    9 as id,
    'Batch Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.batches WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_batches) as target_count;

-- Order Migration
SELECT 
    10 as id,
    'Order Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.orders WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_orders) as target_count;

-- Order Items Migration
SELECT 
    11 as id,
    'Order Items Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.order_items WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_order_items) as target_count;

-- Order Histories Migration
SELECT 
    12 as id,
    'Order Histories Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.order_histories WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_order_histories) as target_count;

-- Order Comments Migration
SELECT 
    13 as id,
    'Order Comments Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.order_comments WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_order_comments) as target_count;

-- Transaction Migration
SELECT 
    14 as id,
    'Transaction Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.transactions WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_transactions) as target_count;

-- Purchase Migration
SELECT 
    15 as id,
    'Purchase Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.purchases WHERE deleted_at IS NULL) as source_count,
    0 as target_count; -- No target table mentioned in original

-- Consumption Migration
SELECT 
    16 as id,
    'Consumption Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.consumptions WHERE deleted_at IS NULL) as source_count,
    0 as target_count; -- No target table mentioned in original

-- Transaction Reasons Migration
SELECT 
    17 as id,
    'Transaction Reasons Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.transaction_reasons WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_transaction_reasons) as target_count;

-- Stock Opname Migration
SELECT 
    18 as id,
    'Stock Opname Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.stock_opnames WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_stock_opnames) as target_count;

-- Reconciliation Migration
SELECT 
    19 as id,
    'Reconciliation Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.reconciliations WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_reconciliations) as target_count;

-- Customer Vendors Migration
SELECT 
    20 as id,
    'Customer Vendors Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.customer_vendors WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_customer_vendors) as target_count;

-- Entity Activities Migration
SELECT 
    21 as id,
    'Entity Activities Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.entity_activities WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_entity_activities) as target_count;

-- Entity Material Activities Migration
SELECT 
    22 as id,
    'Entity Material Activities Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.entity_material_activities WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_entity_material_activities) as target_count;

-- Material Activities Migration
SELECT 
    23 as id,
    'Material Activities Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.material_activities WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_material_activities) as target_count;

-- Material Companions Migration
SELECT 
    24 as id,
    'Material Companions Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.material_companions WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_material_companions) as target_count;

-- Material Manufactures Migration
SELECT 
    25 as id,
    'Material Manufactures Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.material_manufactures WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_material_manufactures) as target_count;

-- Disposal Stocks Migration
SELECT 
    26 as id,
    'Disposal Stocks Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.disposal_stocks WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_disposal_stocks) as target_count;

-- Disposal Transactions Migration
SELECT 
    27 as id,
    'Disposal Transactions Migration' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.disposal_transactions WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714.ws_disposal_transactions) as target_count;

-- =============================================================================
-- COMBINED QUERY FOR ALL MIGRATIONS (SIDE-BY-SIDE)
-- =============================================================================

-- Uncomment and run this query to get all comparisons in one result set:

SELECT * FROM (
    -- Location Migration (Combined)
    SELECT 
        1 as id,
        'Location Migration (Combined)' as table_name,
        (
            (SELECT COUNT(*) FROM prod_logistic_20250714.provinces WHERE deleted_at IS NULL) +
            (SELECT COUNT(*) FROM prod_logistic_20250714.regencies WHERE deleted_at IS NULL) +
            (SELECT COUNT(*) FROM prod_logistic_20250714.sub_districts WHERE deleted_at IS NULL AND id > '731002') +
            (SELECT COUNT(*) FROM prod_logistic_20250714.villages WHERE deleted_at IS NULL)
        ) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.locations) as target_count
    UNION ALL
    -- Activity Migration
    SELECT 
        2 as id,
        'Activity Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.master_activities WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_activities) as target_count
    UNION ALL
    -- User Migration
    SELECT 
        3 as id,
        'User Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.users WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.users) as target_count
    UNION ALL
    -- Entity Migration
    SELECT 
        4 as id,
        'Entity Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.entities WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.entities) as target_count
    UNION ALL
    -- Material Migration
    SELECT 
        5 as id,
        'Material Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.master_materials WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.materials) as target_count
    UNION ALL
    -- Manufacture Migration
    SELECT 
        6 as id,
        'Manufacture Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.manufactures WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.manufactures) as target_count
    UNION ALL
    -- Patient Migration
    SELECT 
        7 as id,
        'Patient Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.patients WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_patients) as target_count
    UNION ALL
    -- Stock Migration
    SELECT 
        8 as id,
        'Stock Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.stocks) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_stocks) as target_count
    UNION ALL
    -- Batch Migration
    SELECT 
        9 as id,
        'Batch Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.batches WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_batches) as target_count
    UNION ALL
    -- Order Migration
    SELECT 
        10 as id,
        'Order Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.orders WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_orders) as target_count
    UNION ALL
    -- Order Histories Migration
    SELECT 
        12 as id,
        'Order Histories Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.order_histories) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_order_histories) as target_count
    UNION ALL
    -- Order Comments Migration
    SELECT 
        13 as id,
        'Order Comments Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.order_comments WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_order_comments) as target_count
    UNION ALL
    -- Transaction Migration
    SELECT 
        14 as id,
        'Transaction Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.transactions WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_transactions) as target_count
    UNION ALL
    -- Transaction Reasons Migration
    SELECT 
        17 as id,
        'Transaction Reasons Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.transaction_reasons WHERE deletedAt IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_transaction_reasons) as target_count
    UNION ALL
    -- Stock Opname Migration
    SELECT 
        18 as id,
        'Stock Opname Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.new_opnames WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_stock_opnames) as target_count
    UNION ALL
    -- Reconciliation Migration
    SELECT 
        19 as id,
        'Reconciliation Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.reconciliation WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_reconciliations) as target_count
    UNION ALL
    -- Customer Vendors Migration
    SELECT 
        20 as id,
        'Customer Vendors Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.customer_vendors WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_customer_vendors) as target_count
    UNION ALL
    -- Entity Activities Migration
    SELECT 
        21 as id,
        'Entity Activities Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.entity_activity_date WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_entity_activities) as target_count
    UNION ALL
    -- Entity Material Activities Migration
    SELECT 
        22 as id,
        'Entity Material Activities Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.entity_master_material_activities emma  WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_entity_material_activities) as target_count
    UNION ALL
    -- Material Activities Migration
    SELECT 
        23 as id,
        'Material Activities Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.master_material_has_activities mmha ) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_material_activities) as target_count
    UNION ALL
    -- Material Companions Migration
    SELECT 
        24 as id,
        'Material Companions Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.material_companions ) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_material_companions) as target_count
    UNION ALL
    -- Material Manufactures Migration
    SELECT 
        25 as id,
        'Material Manufactures Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.material_manufacture ) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_material_manufactures) as target_count
    UNION ALL
    -- Disposal Stocks Migration
    SELECT 
        26 as id,
        'Disposal Stocks Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.stock_exterminations se ) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_disposal_stocks) as target_count
    UNION ALL
    -- Disposal Transactions Migration
    SELECT 
        27 as id,
        'Disposal Transactions Migration' as table_name,
        (SELECT COUNT(*) FROM prod_logistic_20250714.extermination_transactions et  WHERE deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250714.ws_disposal_transactions) as target_count
) AS migration_comparison
ORDER BY id;

-- =============================================================================
-- MAPPING TABLES COUNT VERIFICATION (SIDE-BY-SIDE)
-- =============================================================================

-- Mapping tables verification
SELECT 
    'mapping_activities' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.master_activities WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714_mapping.mapping_activities) as mapping_count;

SELECT 
    'mapping_users' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.users WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714_mapping.mapping_users) as mapping_count;

SELECT 
    'mapping_entities' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.entities WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714_mapping.mapping_entities) as mapping_count;

SELECT 
    'mapping_materials' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.master_materials WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714_mapping.mapping_materials) as mapping_count;

SELECT 
    'mapping_manufactures' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.manufactures WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714_mapping.mapping_manufactures) as mapping_count;

SELECT 
    'mapping_patients' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.patients WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714_mapping.mapping_patients) as mapping_count;

SELECT 
    'mapping_stocks' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.stocks) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714_mapping.mapping_stocks) as mapping_count;

SELECT 
    'mapping_batches' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.batches WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714_mapping.mapping_batches) as mapping_count;

SELECT 
    'mapping_orders' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.orders WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714_mapping.mapping_orders) as mapping_count;

SELECT 
    'mapping_order_items' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.order_items WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714_mapping.mapping_order_items) as mapping_count;

SELECT 
    'mapping_transactions' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.transactions WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714_mapping.mapping_transactions) as mapping_count;

SELECT 
    'mapping_transaction_reasons' as table_name,
    (SELECT COUNT(*) FROM prod_logistic_20250714.transaction_reasons WHERE deleted_at IS NULL) as source_count,
    (SELECT COUNT(*) FROM staging_smile5_20250714_mapping.mapping_transaction_reasons) as mapping_count;