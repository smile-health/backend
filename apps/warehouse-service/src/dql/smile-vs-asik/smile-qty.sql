SELECT 
  dt.entities_regency_id AS regency_id, 
  dt.entities_regency_name AS regency_name, 
  dmm_vial.vial AS vial, 
  sum(
    abs(
      coalesce(wtot.konsumsi, 0)
    ) - abs(
      coalesce(wtot.pengembalian_faskes, 0)
    )
  ) AS smile_qty 
FROM 
  bronze_layer_v5_staging.datamart_transactions_v5 AS dt FINAL 
  LEFT JOIN bronze_layer_v5_staging.raw_ws_transaction_order_type AS wtot ON dt.transactions_id = wtot.transactions_id 
  INNER JOIN (
    SELECT 
      id, 
      sum(
        coalesce(
          rwm.consumption_unit_per_distribution_unit, 
          0
        )
      ) AS vial 
    FROM 
      bronze_layer_v5_staging.raw_materials AS rwm FINAL 
    GROUP BY 
      id
  ) AS dmm_vial ON dmm_vial.id = dt.transactions_master_material_id 
WHERE 
  dt.transactions_created_at BETWEEN ${start_date} 
  AND ${end_date} -- AND dt.master_materials_is_vaccine IN ${isVaccine} 
  AND dt.join_date IS NOT NULL 
  AND (
    (
      dt.join_date <= ${currentDate} 
      AND dt.end_date >= ${currentDate}
    ) 
    OR (
      dt.end_date IS NULL 
      AND dt.join_date <= ${currentDate}
    )
  ) 
  AND dt.entities_province_id IN ${provinceId} 
  AND dt.transactions_master_material_id = ${masterMaterialId} 
  AND dt.transactions_activity_id IN ${activityId} -- Penggunaan arrayExists untuk filter entity tags
  AND dt.entities_entity_tag_id IN ${entityTags} 
GROUP BY 
  1, 
  2, 
  3 
ORDER BY 
  1 ASC;

-- Params:
-- {
--   params: {
--     activityId: [ 4 ],
--     masterMaterialId: [ 170 ],
--     provinceId: [ 32 ],
--     entityTags: [ 5 ],

--     fromDate: '2025-01-01',
--     toDate: '2025-09-01'
--   }
-- }