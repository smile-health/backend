WITH toDate(now()) AS reference_date
-- ,{from:DateTime('Asia/Jakarta')} as date_start_spec, 
--    {to:DateTime('Asia/Jakarta')} as date_end_spec 
SELECT 
 dolv.customer_id AS customer_id,
   dolv.customer_name AS customer_name,
 AVG(dolv.duration_order_to_allocation) / 86400  AS doa,
 AVG(dolv.duration_allocation_to_shipped) / 86400  AS das,
 AVG(dolv.duration_shipped_to_received) / 86400  AS dsr
FROM datamart_order_list_v5 dolv FINAL
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
 AND length(dolv.material_id) > 0
--  AND toDate(dolv.order_created_at + interval 7 hours) 
--   BETWEEN date_start_spec and date_end_spec
GROUP BY 1,2;