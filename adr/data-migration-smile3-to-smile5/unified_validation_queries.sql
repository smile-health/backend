-- Unified Data Validation Queries for SMILE 3.0 to 5.0 Migration
-- Generated from use_case_data_validation.csv
-- This file contains all validation queries from both 3.0 and 5.0 systems

-- =============================================================================
-- QUERY 1: cek entitas puskesmas
-- =============================================================================

-- 3.0 Query
SELECT 'Query 1 - 3.0' as source, 'cek entitas puskesmas' as use_case, count(*) as result
FROM prod_logistic_20250803.entities e
WHERE is_puskesmas = 1
  AND province_id = 32
UNION ALL
-- 5.0 Query
SELECT 'Query 1 - 5.0' as source, 'cek entitas puskesmas' as use_case, count(*) as result
FROM prod_smile5_test.entities e
WHERE is_puskesmas = 1
  AND province_id = 32
  AND deleted_at is null
;

-- =============================================================================
-- QUERY 2: cek entitas dinkes
-- =============================================================================

-- 3.0 Query
SELECT 'Query 2 - 3.0' as source, 'cek entitas dinkes' as use_case, count(*) as result
FROM prod_logistic_20250803.entities e
WHERE NAME like 'DINKES%'
  AND deleted_at is null
UNION ALL
-- 5.0 Query
SELECT 'Query 2 - 5.0' as source, 'cek entitas dinkes' as use_case, count(*) as result
FROM prod_smile5_test.entities e
WHERE NAME like 'DINKES%'
  AND deleted_at is null
;
-- =============================================================================
-- QUERY 3: Cek entitas RS
-- =============================================================================

-- 3.0 Query
SELECT 'Query 3 - 3.0' as source, 'Cek entitas RS' as use_case, count(*) as result
FROM prod_logistic_20250803.entities e
WHERE name LIKE 'RS%'
UNION ALL
-- 5.0 Query
SELECT 'Query 3 - 5.0' as source, 'Cek entitas RS' as use_case, count(*) as result
FROM prod_smile5_test.entities e
WHERE name LIKE 'RS%'
;
-- =============================================================================
-- QUERY 4: cek id entity tag
-- =============================================================================

-- 3.0 Query
SELECT 'Query 4 - 3.0' as source, 'cek id entity tag' as use_case, count(id) as result
FROM prod_logistic_20250803.entity_tags et
WHERE et.deleted_at is null
UNION ALL
-- 5.0 Query
SELECT 'Query 4 - 5.0' as source, 'cek id entity tag' as use_case, count(id) as result
FROM prod_smile5_test.entity_tags et
WHERE et.deleted_at is null
;
-- =============================================================================
-- QUERY 5: cek jumlah transaksi per aktivitas
-- =============================================================================

-- 3.0 Query
SELECT 'Query 5 - 3.0' as source, 'cek jumlah transaksi per aktivitas' as use_case, 
       ma.name as activity_name, COUNT(1) as result
FROM prod_logistic_20250803.transactions t
LEFT JOIN prod_logistic_20250803.stocks s ON t.stock_id = s.id
LEFT JOIN prod_logistic_20250803.master_activities ma ON s.activity_id = ma.id
WHERE t.createdAt < '2025-04-25'
  AND t.deleted_at IS NULL
GROUP BY ma.name
ORDER BY ma.name
UNION ALL
-- 5.0 Query
SELECT 'Query 5 - 5.0' as source, 'cek jumlah transaksi per aktivitas' as use_case,
       wa.name as activity_name, COUNT(1) as result
FROM prod_smile5_test.ws_transactions wt
LEFT JOIN prod_smile5_test.ws_stocks ws ON wt.stock_id = ws.id
LEFT JOIN prod_smile5_test.ws_activities wa ON ws.activity_id = wa.id
WHERE wt.created_at < '2025-04-25'
  AND wt.deleted_at IS NULL
GROUP BY wa.name
ORDER BY wa.name
;
-- =============================================================================
-- QUERY 6: cek province
-- =============================================================================

-- 3.0 Query
SELECT 'Query 6 - 3.0' as source, 'cek province' as use_case, count(name) as result
FROM prod_logistic_20250803.provinces p
UNION ALL
-- 5.0 Query
SELECT 'Query 6 - 5.0' as source, 'cek province' as use_case, count(distinct name) as result
FROM prod_smile5_test.locations l
WHERE name like 'PROV%'
;
-- =============================================================================
-- QUERY 7: cek regency
-- =============================================================================

-- 3.0 Query
SELECT 'Query 7 - 3.0' as source, 'cek regency' as use_case, count(distinct r.name) as result
FROM prod_logistic_20250803.regencies r
WHERE r.deleted_at IS NULL
UNION ALL
-- 5.0 Query
SELECT 'Query 7 - 5.0' as source, 'cek regency' as use_case, count(distinct l.name) as result
FROM prod_smile5_test.locations l
WHERE level=1
;
-- =============================================================================
-- QUERY 8: cek id transaction
-- =============================================================================

-- 3.0 Query
SELECT 'Query 8 - 3.0' as source, 'cek id transaction' as use_case, count(distinct t.id) as result
FROM prod_logistic_20250803.transactions t
WHERE t.deleted_at is null
UNION ALL
-- 5.0 Query
SELECT 'Query 8 - 5.0' as source, 'cek id transaction' as use_case, count(distinct wt.id) as result
FROM prod_smile5_test.ws_transactions wt
;
-- =============================================================================
-- QUERY 9: cek material
-- =============================================================================

-- 3.0 Query
SELECT 'Query 9 - 3.0' as source, 'cek material' as use_case, count(name) as result
FROM prod_logistic_20250803.master_materials
UNION ALL
-- 5.0 Query
SELECT 'Query 9 - 5.0' as source, 'cek material' as use_case, count(name) as result
FROM prod_smile5_test.materials m
;
-- =============================================================================
-- QUERY 10: cek list activity di trx
-- =============================================================================

-- 3.0 Query
SELECT 'Query 10 - 3.0' as source, 'cek list activity di trx' as use_case,
       t.activity_id, ma.name as activity_name, count(*) as result
FROM prod_logistic_20250803.transactions t
LEFT JOIN prod_logistic_20250803.master_activities ma ON t.activity_id = ma.id
WHERE t.deleted_at is null
GROUP BY t.activity_id, ma.name
UNION ALL
-- 5.0 Query
SELECT 'Query 10 - 5.0' as source, 'cek list activity di trx' as use_case,
       wt.activity_id, wa.name as activity_name, count(*) as result
FROM prod_smile5_test.ws_transactions wt
LEFT JOIN prod_smile5_test.ws_activities wa ON wt.activity_id = wa.id
WHERE wt.deleted_at is null
GROUP BY wt.activity_id, wa.name
;
-- =============================================================================
-- QUERY 11: cek open and change qty di transactions
-- =============================================================================

-- 3.0 Query
SELECT 'Query 11 - 3.0' as source, 'cek open and change qty di transactions' as use_case,
       sum(abs(change_qty)) as sum_change_qty_OLTP,
       sum(abs(opening_qty)) as sum_opn_qty_OLTP
FROM prod_logistic_20250803.transactions t
WHERE t.deleted_at is null
UNION ALL
-- 5.0 Query
SELECT 'Query 11 - 5.0' as source, 'cek open and change qty di transactions' as use_case,
       sum(abs(change_qty)) as sum_change_qty_OLTP,
       sum(abs(opening_qty)) as sum_opn_qty_OLTP
FROM prod_smile5_test.ws_transactions wt
;
-- =============================================================================
-- QUERY 12: cek order status
-- =============================================================================

-- 3.0 Query
SELECT 'Query 12 - 3.0' as source, 'cek order status' as use_case,
       o.status, count(o.status) as result
FROM prod_logistic_20250803.orders o
WHERE o.deleted_at is null
GROUP BY o.status
ORDER BY o.status asc
UNION ALL
-- 5.0 Query
SELECT 'Query 12 - 5.0' as source, 'cek order status' as use_case,
       wo.order_status_id as status, count(wo.order_status_id) as result
FROM prod_smile5_test.ws_orders wo
GROUP BY wo.order_status_id
ORDER BY wo.order_status_id asc
;
-- =============================================================================
-- QUERY 13: jumlah material untuk activity Malaria - Rutin pada transaksi
-- =============================================================================

-- 3.0 Query
SELECT 'Query 13 - 3.0' as source, 'jumlah material untuk activity Malaria - Rutin pada transaksi' as use_case,
       t.activity_id, ma.name as activity_name,
       mm.platform_material_id as material_id, count(*) as result
FROM prod_logistic_20250803.transactions t
LEFT JOIN prod_logistic_20250803.master_activities ma ON t.activity_id = ma.id
LEFT JOIN dev_smile_platform_mapping.mapping_materials mm ON t.master_material_id = mm.platform_material_id
WHERE t.deleted_at is null AND ma.name = 'Malaria - Rutin'
GROUP BY t.activity_id, ma.name, mm.platform_material_id
UNION ALL
-- 5.0 Query
SELECT 'Query 13 - 5.0' as source, 'jumlah material untuk activity Malaria - Rutin pada transaksi' as use_case,
       wt.activity_id, wa.name as activity_name,
       ws.material_id AS transactions_master_material_id, count(*) as result
FROM prod_smile5_test.ws_transactions wt
LEFT JOIN prod_smile5_test.ws_activities wa ON wt.activity_id = wa.id
LEFT JOIN prod_smile5_test.ws_stocks ws ON wt.stock_id = ws.id
LEFT JOIN prod_smile5_test.materials wm ON wm.id = ws.material_id
WHERE wt.deleted_at is null AND wa.name = 'Malaria - Rutin'
GROUP BY wt.activity_id, wa.name, ws.material_id
;
-- =============================================================================
-- QUERY 14: stock opname by province
-- =============================================================================

-- 3.0 Query
SELECT 'Query 14 - 3.0' as source, 'stock opname by province' as use_case,
       p.name as province_name, count(*) as result
FROM prod_logistic_20250803.new_opnames nos
LEFT JOIN prod_imun_20250425.entities e ON nos.entity_id = e.id
LEFT JOIN prod_imun_20250425.provinces p ON e.province_id = p.id
GROUP BY p.name
UNION ALL
-- 5.0 Query
SELECT 'Query 14 - 5.0' as source, 'stock opname by province' as use_case,
       p.name AS province_name, count(*) as result
FROM prod_smile5_test.ws_stock_opnames wso
LEFT JOIN prod_smile5_test.ws_entities we ON wso.entity_id = we.id
LEFT JOIN prod_smile5_test.locations p ON we.province_id = p.id AND p.level = 0
GROUP BY p.name
;
-- =============================================================================
-- QUERY 15: jumlah stock opname by activity
-- =============================================================================

-- 3.0 Query
SELECT 'Query 15 - 3.0' as source, 'jumlah stock opname by activity' as use_case,
       nos.activity_id, count(*) as result
FROM prod_logistic_20250803.new_opnames nos
WHERE deleted_at is null
GROUP BY nos.activity_id
UNION ALL
-- 5.0 Query
SELECT 'Query 15 - 5.0' as source, 'jumlah stock opname by activity' as use_case,
       wso.activity_id, count(*) as result
FROM prod_smile5_test.ws_stock_opnames wso
WHERE wso.deleted_at is null
GROUP BY wso.activity_id
;
-- =============================================================================
-- QUERY 16: jumlah stock opname by material
-- =============================================================================

-- 3.0 Query
SELECT 'Query 16 - 3.0' as source, 'jumlah stock opname by material' as use_case,
       noi.master_material_id, mm.platform_material_id, COUNT(*) AS result
FROM prod_logistic_20250803.new_opname_items noi
LEFT JOIN dev_smile_platform_mapping.mapping_materials mm ON noi.master_material_id = mm.existing_material_id
WHERE noi.deleted_at IS NOT NULL
GROUP BY noi.master_material_id, mm.platform_material_id
UNION ALL
-- 5.0 Query
SELECT 'Query 16 - 5.0' as source, 'jumlah stock opname by material' as use_case,
       wso.material_id, NULL as platform_material_id, count(*) as result
FROM prod_smile5_test.ws_stock_opnames wso
WHERE wso.deleted_at is null
GROUP BY wso.material_id
;
-- =============================================================================
-- QUERY 17: jumlah so by batch
-- =============================================================================

-- 3.0 Query
SELECT 'Query 17 - 3.0' as source, 'jumlah so by batch' as use_case, count(*) as result
FROM new_opname_stocks nos
UNION ALL
-- 5.0 Query
SELECT 'Query 17 - 5.0' as source, 'jumlah so by batch' as use_case, count(*) as result
FROM prod_smile5_test.ws_stock_opnames wso
;
-- =============================================================================
-- QUERY 18: Jumlah transaksi konsumsi
-- =============================================================================

-- 3.0 Query
SELECT 'Query 18 - 3.0' as source, 'Jumlah transaksi konsumsi' as use_case, COUNT(1) as result
FROM prod_logistic_20250803.transactions t
WHERE t.transaction_type_id = 2 AND t.order_id is null
UNION ALL
-- 5.0 Query
SELECT 'Query 18 - 5.0' as source, 'Jumlah transaksi konsumsi' as use_case, COUNT(1) as result
FROM prod_smile5_test.ws_transactions wt
WHERE wt.transaction_type_id = 10
;
-- =============================================================================
-- QUERY 19: Jumlah transaksi penerimaan
-- =============================================================================

-- 3.0 Query
SELECT 'Query 19 - 3.0' as source, 'Jumlah transaksi penerimaan' as use_case, count(*) as result
FROM prod_logistic_20250803.transactions t
WHERE t.transaction_type_id = 3 AND t.deleted_at is null
UNION ALL
-- 5.0 Query
SELECT 'Query 19 - 5.0' as source, 'Jumlah transaksi penerimaan' as use_case, count(*) as result
FROM prod_smile5_test.ws_transactions wt
WHERE wt.transaction_type_id = 3
;
-- =============================================================================
-- QUERY 20: Jumlah transaksi distribusi
-- =============================================================================

-- 3.0 Query
SELECT 'Query 20 - 3.0' as source, 'Jumlah transaksi distribusi' as use_case, count(*) as result
FROM prod_logistic_20250803.transactions t
JOIN prod_logistic_20250803.orders o on t.order_id = o.id
WHERE t.transaction_type_id = 2 AND o.type = 2 AND t.deleted_at is null
UNION ALL
-- 5.0 Query
SELECT 'Query 20 - 5.0' as source, 'Jumlah transaksi distribusi' as use_case, count(*) as result
FROM prod_smile5_test.ws_transactions wt
JOIN ws_orders wo on wt.order_id = wo.id
WHERE wt.transaction_type_id = 2 AND wo.order_type_id = 2
;
-- =============================================================================
-- QUERY 21: Jumlah transaksi pengembalian faskes
-- =============================================================================

-- 3.0 Query
SELECT 'Query 21 - 3.0' as source, 'Jumlah transaksi pengembalian faskes' as use_case, count(*) as result
FROM prod_logistic_20250803.transactions t
WHERE t.transaction_type_id = 5 AND t.deleted_at is null
UNION ALL
-- 5.0 Query
SELECT 'Query 21 - 5.0' as source, 'Jumlah transaksi pengembalian faskes' as use_case, count(*) as result
FROM prod_smile5_test.ws_transactions wt
WHERE wt.transaction_type_id = 5
;
-- =============================================================================
-- QUERY 22: Jumlah transaksi pengembalian
-- =============================================================================

-- 3.0 Query
SELECT 'Query 22 - 3.0' as source, 'Jumlah transaksi pengembalian' as use_case, count(*) as result
FROM prod_logistic_20250803.transactions t
JOIN prod_logistic_20250803.orders o on t.order_id = o.id
WHERE t.transaction_type_id = 2 AND o.type = 3 AND t.deleted_at is null
UNION ALL
-- 5.0 Query
SELECT 'Query 22 - 5.0' as source, 'Jumlah transaksi pengembalian' as use_case, count(*) as result
FROM prod_smile5_test.ws_transactions wt
JOIN ws_orders wo on wt.order_id = wo.id
WHERE wt.transaction_type_id = 2 AND wo.order_type_id = 3
;
-- =============================================================================
-- QUERY 23: Jumlah transaksi pembuangan
-- =============================================================================

-- 3.0 Query
SELECT 'Query 23 - 3.0' as source, 'Jumlah transaksi pembuangan' as use_case, count(*) as result
FROM prod_logistic_20250803.transactions t
WHERE t.transaction_type_id = 4 AND t.deleted_at is null
UNION ALL
-- 5.0 Query
SELECT 'Query 23 - 5.0' as source, 'Jumlah transaksi pembuangan' as use_case, count(*) as result
FROM prod_smile5_test.ws_transactions wt
WHERE wt.transaction_type_id = 4
;
-- =============================================================================
-- QUERY 24: Jumlah transaksi pembatalan pembuangan
-- =============================================================================

-- 3.0 Query
SELECT 'Query 24 - 3.0' as source, 'Jumlah transaksi pembatalan pembuangan' as use_case, count(*) as result
FROM prod_logistic_20250803.transactions t
WHERE t.transaction_type_id = 9 AND t.deleted_at is null
UNION ALL
-- 5.0 Query
SELECT 'Query 24 - 5.0' as source, 'Jumlah transaksi pembatalan pembuangan' as use_case, count(*) as result
FROM prod_smile5_test.ws_transactions wt
WHERE wt.transaction_type_id = 9
;
-- =============================================================================
-- QUERY 25: Jumlah rekonsiliasi
-- =============================================================================

-- 3.0 Query
SELECT 'Query 25 - 3.0' as source, 'Jumlah rekonsiliasi' as use_case, count(*) as result
FROM prod_logistic_20250803.reconciliation r
UNION ALL
-- 5.0 Query
SELECT 'Query 25 - 5.0' as source, 'Jumlah rekonsiliasi' as use_case, count(*) as result
FROM prod_smile5_test.ws_reconciliations wr
;
-- =============================================================================
-- QUERY 26: Jumlah item rekonsiliasi
-- =============================================================================

-- 3.0 Query
SELECT 'Query 26 - 3.0' as source, 'Jumlah item rekonsiliasi' as use_case, count(*) as result
FROM prod_logistic_20250803.reconciliation_items ri
UNION ALL
-- 5.0 Query
SELECT 'Query 26 - 5.0' as source, 'Jumlah item rekonsiliasi' as use_case, count(*) as result
FROM prod_smile5_test.ws_reconciliation_items wri
;
-- =============================================================================
-- QUERY 27: Jumlah remaining stock per material
-- =============================================================================

-- 3.0 Query
SELECT 'Query 27 - 3.0' as source, 'Jumlah remaining stock per material' as use_case,
       ri.stock_category, sum(ri.smile_qty) as smile_qty, sum(ri.real_qty) as real_qty
FROM prod_logistic_20250803.reconciliation r
JOIN prod_logistic_20250803.reconciliation_items ri on r.id = ri.reconciliation_id
JOIN prod_logistic_20250803.master_materials mm on r.master_material_id = mm.id
WHERE ri.stock_category = 7
GROUP BY ri.stock_category
UNION ALL
-- 5.0 Query
SELECT 'Query 27 - 5.0' as source, 'Jumlah remaining stock per material' as use_case,
       wri.reconciliation_category_id, sum(wri.recorded_qty) as recorded_qty, sum(wri.actual_qty) as actual_qty
FROM prod_smile5_test.ws_reconciliations wr
JOIN prod_smile5_test.ws_reconciliation_items wri on wr.id = wri.reconciliation_id
JOIN prod_smile5_test.ws_materials wm on wr.material_id = wm.id
WHERE wri.reconciliation_category_id = 7
GROUP BY wri.reconciliation_category_id
;
-- =============================================================================
-- QUERY 28: Anomali Batch Id Mapping in 5.0
-- =============================================================================

-- 3.0 Query
SELECT 'Query 28 - 3.0' as source, 'Anomali Batch Id Mapping in 5.0' as use_case, 
       t.id, t.batch_code, t.activity_id
FROM transactions t
WHERE t.id = 65153
UNION ALL
-- 5.0 Query
SELECT 'Query 28 - 5.0' as source, 'Anomali Batch Id Mapping in 5.0' as use_case,
       wt.id, wt.batch_code, wt.activity_id
FROM prod_smile5_test.ws_transactions wt
WHERE (wt.batch_code IS NOT NULL) AND activity_id = 12 AND id = 257213;

-- Additional 5.0 Query for ws_stocks
-- SELECT * FROM prod_smile5_test.ws_stocks ws WHERE ws.id = 2977781;

SELECT count(*)
from prod_logistic_20250803.transactions t 
left join prod_logistic_20250803.stocks s on t.stock_id = s.id
where t.activity_id is not null and s.activity_id is null
union all
select count(*)
from prod_smile5_test.ws_transactions wt 
left join prod_smile5_test.ws_stocks ws on wt.stock_id = ws.id
where wt.activity_id is not null and ws.activity_id is null

-- =============================================================================
-- ASSET MIGRATION VALIDATION QUERIES
-- Generated from asset migration scripts
-- =============================================================================

-- Database Variables for Asset Migration Queries
-- SET @iot_db = 'prod_logistic_20250803_iot';           -- 3.0 IoT Database
-- SET @platform_db = 'prod_smile5_test'; -- 5.0 Platform Database

-- =============================================================================
-- QUERY 29: Asset Types Count
-- =============================================================================

-- 3.0 Query (IoT Database)
SELECT 'Query 29 - 3.0' as source, 'Asset Types Count' as use_case, count(*) as result
FROM prod_logistic_20250803_iot.asset_type
WHERE deleted_at IS NULL
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 29 - 5.0' as source, 'Asset Types Count' as use_case, count(*) as result
FROM prod_smile5_test.asset_types
WHERE deleted_at IS NULL
;

-- =============================================================================
-- QUERY 30: Asset Models Count
-- =============================================================================

-- 3.0 Query (IoT Database)
SELECT 'Query 30 - 3.0' as source, 'Asset Models Count' as use_case, count(*) as result
FROM prod_logistic_20250803_iot.asset_model
WHERE deleted_at IS NULL
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 30 - 5.0' as source, 'Asset Models Count' as use_case, count(*) as result
FROM prod_smile5_test.asset_models
WHERE deleted_at IS NULL
;

-- =============================================================================
-- QUERY 31: Asset Vendors Count
-- =============================================================================

-- 3.0 Query (IoT Database)
SELECT 'Query 31 - 3.0' as source, 'Asset Vendors Count' as use_case, count(*) as result
FROM prod_logistic_20250803_iot.asset_vendors
WHERE deleted_at IS NULL
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 31 - 5.0' as source, 'Asset Vendors Count' as use_case, count(*) as result
FROM prod_smile5_test.asset_vendors
WHERE deleted_at IS NULL
;

-- =============================================================================
-- QUERY 32: Asset Type Workspaces Count
-- =============================================================================

-- 3.0 Query (No equivalent in IoT Database)
SELECT 'Query 32 - 3.0' as source, 'Asset Type Workspaces Count' as use_case, 0 as result
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 32 - 5.0' as source, 'Asset Type Workspaces Count' as use_case, count(*) as result
FROM prod_smile5_test.asset_type_workspaces
;

-- =============================================================================
-- QUERY 33: Asset Model Workspaces Count
-- =============================================================================

-- 3.0 Query (No equivalent in IoT Database)
SELECT 'Query 33 - 3.0' as source, 'Asset Model Workspaces Count' as use_case, 0 as result
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 33 - 5.0' as source, 'Asset Model Workspaces Count' as use_case, count(*) as result
FROM prod_smile5_test.asset_model_workspaces
;

-- =============================================================================
-- QUERY 34: Asset Vendor Workspaces Count
-- =============================================================================

-- 3.0 Query (No equivalent in IoT Database)
SELECT 'Query 34 - 3.0' as source, 'Asset Vendor Workspaces Count' as use_case, 0 as result
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 34 - 5.0' as source, 'Asset Vendor Workspaces Count' as use_case, count(*) as result
FROM prod_smile5_test.asset_vendor_workspaces
;

-- =============================================================================
-- QUERY 35: Asset Calibration Schedules Count
-- =============================================================================

-- 3.0 Query (No equivalent in IoT Database - static data)
SELECT 'Query 35 - 3.0' as source, 'Asset Calibration Schedules Count' as use_case, 0 as result
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 35 - 5.0' as source, 'Asset Calibration Schedules Count' as use_case, count(*) as result
FROM prod_smile5_test.ws_asset_calibration_schedules
;

-- =============================================================================
-- QUERY 36: Asset Electricities Count
-- =============================================================================

-- 3.0 Query (No equivalent in IoT Database - static data)
SELECT 'Query 36 - 3.0' as source, 'Asset Electricities Count' as use_case, 0 as result
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 36 - 5.0' as source, 'Asset Electricities Count' as use_case, count(*) as result
FROM prod_smile5_test.ws_asset_electricities
;

-- =============================================================================
-- QUERY 37: Asset Maintenance Schedules Count
-- =============================================================================

-- 3.0 Query (No equivalent in IoT Database - static data)
SELECT 'Query 37 - 3.0' as source, 'Asset Maintenance Schedules Count' as use_case, 0 as result
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 37 - 5.0' as source, 'Asset Maintenance Schedules Count' as use_case, count(*) as result
FROM prod_smile5_test.ws_asset_maintenance_schedules
;

-- =============================================================================
-- QUERY 38: Asset Working Statuses Count
-- =============================================================================

-- 3.0 Query (No equivalent in IoT Database - static data)
SELECT 'Query 38 - 3.0' as source, 'Asset Working Statuses Count' as use_case, 0 as result
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 38 - 5.0' as source, 'Asset Working Statuses Count' as use_case, count(*) as result
FROM prod_smile5_test.ws_asset_working_statuses
;

-- =============================================================================
-- QUERY 39: Asset Inventories Count
-- =============================================================================

-- 3.0 Query (IoT Database)
SELECT 'Query 39 - 3.0' as source, 'Asset Inventories Count' as use_case, count(*) as result
FROM prod_logistic_20250803_iot.assets
WHERE deleted_at IS NULL
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 39 - 5.0' as source, 'Asset Inventories Count' as use_case, count(*) as result
FROM prod_smile5_test.ws_asset_inventories
WHERE deleted_at IS NULL
;

-- =============================================================================
-- QUERY 40: Asset Inventories by Entity Count
-- =============================================================================

-- 3.0 Query (IoT Database)
SELECT 'Query 40 - 3.0' as source, 'Asset Inventories by Entity Count' as use_case, 
       entity_id, count(*) as result
FROM prod_logistic_20250803_iot.assets
WHERE deleted_at IS NULL AND entity_id IS NOT NULL
GROUP BY entity_id
ORDER BY entity_id
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 40 - 5.0' as source, 'Asset Inventories by Entity Count' as use_case,
       entity_id, count(*) as result
FROM prod_smile5_test.ws_asset_inventories
WHERE deleted_at IS NULL AND entity_id IS NOT NULL
GROUP BY entity_id
ORDER BY entity_id
;

-- =============================================================================
-- QUERY 41: Asset Inventories by Asset Type Count
-- =============================================================================

-- 3.0 Query (IoT Database)
SELECT 'Query 41 - 3.0' as source, 'Asset Inventories by Asset Type Count' as use_case,
       asset_type_id, count(*) as result
FROM prod_logistic_20250803_iot.assets
WHERE deleted_at IS NULL AND asset_type_id IS NOT NULL
GROUP BY asset_type_id
ORDER BY asset_type_id
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 41 - 5.0' as source, 'Asset Inventories by Asset Type Count' as use_case,
       asset_type_id, count(*) as result
FROM prod_smile5_test.ws_asset_inventories
WHERE deleted_at IS NULL AND asset_type_id IS NOT NULL
GROUP BY asset_type_id
ORDER BY asset_type_id
;

-- =============================================================================
-- QUERY 42: Asset Inventories by Asset Model Count
-- =============================================================================

-- 3.0 Query (IoT Database)
SELECT 'Query 42 - 3.0' as source, 'Asset Inventories by Asset Model Count' as use_case,
       asset_model_id, count(*) as result
FROM prod_logistic_20250803_iot.assets
WHERE deleted_at IS NULL AND asset_model_id IS NOT NULL
GROUP BY asset_model_id
ORDER BY asset_model_id
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 42 - 5.0' as source, 'Asset Inventories by Asset Model Count' as use_case,
       asset_model_id, count(*) as result
FROM prod_smile5_test.ws_asset_inventories
WHERE deleted_at IS NULL AND asset_model_id IS NOT NULL
GROUP BY asset_model_id
ORDER BY asset_model_id
;

-- =============================================================================
-- QUERY 43: Asset Vendor Types Count
-- =============================================================================

-- 3.0 Query (No equivalent in IoT Database - created during migration)
SELECT 'Query 43 - 3.0' as source, 'Asset Vendor Types Count' as use_case, 0 as result
UNION ALL
-- 5.0 Query (Platform Database)
SELECT 'Query 43 - 5.0' as source, 'Asset Vendor Types Count' as use_case, count(*) as result
FROM prod_smile5_test.asset_vendor_types
;

-- =============================================================================
-- END OF UNIFIED VALIDATION QUERIES
-- =============================================================================

/*
NOTES:
1. This file contains all validation queries from the CSV file
2. Each query is labeled with its source (3.0 or 5.0) and use case
3. UNION ALL is used to combine all results into a single result set
4. Some queries have been standardized to include consistent column names
5. The queries can be executed together to compare results between systems
6. Some complex queries with different result structures are included as separate sections
*/