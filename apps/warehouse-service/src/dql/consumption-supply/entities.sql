SELECT
 dt.entities_id , 
 dt.entities_name,
-- toDate(toDateTime(dt.transactions_created_at + interval 7 hours)) as day,
 -- formatDateTime(toDateTime(dt.transactions_created_at + interval 7 hours), '%Y-%m')as month,
    COALESCE(sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id IN (10,5) AND transactions_order_id IS NULL),0) -- KONSUMSI_QTY
    + COALESCE(sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id = 2 AND transactions_order_id IS NOT NULL AND orders_order_type_id IN (1,2,4) AND orders_order_status_id IN (4,5)),0) -- PENGELUARAN_QTY
    + COALESCE(sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id = 2 AND transactions_order_id IS NOT NULL AND orders_order_type_id = 3 AND orders_order_status_id IN (4,5)),0) -- PENGEMBALIAN_QTY
    as consumption,
    COALESCE(sum(transactions_change_qty) FILTER (WHERE transactions_transaction_type_id = 3 AND transactions_order_id IS NOT NULL AND orders_order_type_id IN (1,2,4) AND orders_order_status_id = 5),0) -- PENERIMAAN_QTY
    + COALESCE(sum(transactions_change_qty) FILTER (WHERE transactions_transaction_type_id = 3 AND transactions_order_id IS NOT NULL AND orders_order_type_id = 3 AND orders_order_status_id = 5),0) -- PENERIMAAN_PENGEMBALIAN_QTY
    as supply
FROM datamart_monitoring_transactions_v5 dt FINAL
WHERE 1=1
AND dt.transactions_deleted_at IS NULL 
AND dt.master_deleted_at IS NULL  
AND dt.entities_is_vendor = 1 
AND dt.entities_status = 1
AND dt.entities_type <> 5
AND ((dt.join_date <= toDate(now()) and dt.end_date >= toDate(now())) or (dt.end_date is null and dt.join_date <= toDate(now())))
--AND toDate(dt.transactions_created_at + interval 7 hours) BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')} 
--AND dt.program_id = 2 
--AND dt.transactions_activity_id in (${activity_id})
--AND dt.entities_province_id = ${provinde_id}
--AND dt.entities_regency_id = ${regency_id}
--AND arrayJoin(dt.entity_tags_id) in (${entity_tag_id})
--AND dt.transactions_master_material_id in (${material_id})
--AND dt.masterial_type_id in (${is_vaccine})
--AND dtentities_id = ${entity_id}
GROUP BY 1,2
-- ORDER BY 1 ASC