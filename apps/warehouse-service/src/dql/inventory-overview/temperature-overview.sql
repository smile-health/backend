SELECT
  latest_status_excursion,
  countDistinct(asset_inventory_id) AS inventory_count
FROM
(
  SELECT
    dlm.asset_inventory_id as asset_inventory_id,
    argMax(latest_status_excursion, dlm.max_datetime) AS latest_status_excursion
  FROM datamart_logger_monitoring dlm FINAL
  WHERE
    dlm.asset_inventory_id is not null
    AND has(dlm.asset_classifications_id, 1)
  GROUP BY dlm.asset_inventory_id
)
GROUP BY latest_status_excursion