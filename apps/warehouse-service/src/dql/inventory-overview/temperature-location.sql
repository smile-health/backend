SELECT
	location_id,
  latest_status_excursion,
  countDistinct(asset_inventory_id) AS inventory_count
FROM
(
  SELECT
    dlm.entity_id as location_id,
    dlm.asset_inventory_id as asset_inventory_id,
    argMax(dlm.latest_status_excursion, dlm.max_datetime) AS latest_status_excursion
  FROM datamart_logger_monitoring dlm FINAL
  WHERE
    dlm.asset_inventory_id is not null
  AND has(dlm.asset_classifications_id, 1)
  GROUP BY location_id, dlm.asset_inventory_id
)
GROUP BY 
	location_id,
	latest_status_excursion 