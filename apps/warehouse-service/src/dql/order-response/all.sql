WITH toDate(now()) AS reference_date
-- ,{from:DateTime('Asia/Jakarta')} as date_start_spec, 
--    {to:DateTime('Asia/Jakarta')} as date_end_spec 
SELECT 
 dolv.order_id AS order_id,
 dolv.activity_name AS activity_name,
 dolv.activity_id AS activity_id,
 material_id_array,
 dolv.customer_province_name AS customer_province_name,
 dolv.customer_province_id AS customer_province_id,
    dolv.customer_regency_name AS customer_regency_name,
 dolv.customer_regency_id AS customer_regency_id,
   dolv.customer_name AS customer_name,
 dolv.customer_id,
 toMonth(toDateTime(dolv.order_created_at, 'Asia/Jakarta')) AS month,
 toYear(toDateTime(dolv.order_created_at, 'Asia/Jakarta')) AS year,
 AVG(dolv.duration_order_to_allocation) / 86400 AS doa,
 AVG(dolv.duration_allocation_to_shipped) / 86400 AS das,
 AVG(dolv.duration_shipped_to_received) / 86400 AS dsr 
FROM datamart_order_list_v5 dolv FINAL
ARRAY JOIN dolv.material_id AS material_id_array
WHERE
 dolv.entity_activity_start_date IS NOT NULL 
 AND (
 (
  dolv.entity_activity_start_date <= reference_date 
  AND dolv.entity_activity_end_date >= reference_date
 )
 OR 
 (
  dolv.entity_activity_end_date IS NULL 
  AND dolv.entity_activity_start_date <= reference_date
 )
  )
 AND dolv.deleted_at IS NULL 
 AND dolv.customer_status = 1
 AND dolv.customer_type <> 5
--  AND toDate(dolv.order_created_at + interval 7 hours) 
--   BETWEEN date_start_spec and date_end_spec
-- AND arrayExists(i -> i in {MaterialId:Array(Int)}, dolv.material_id)
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12;