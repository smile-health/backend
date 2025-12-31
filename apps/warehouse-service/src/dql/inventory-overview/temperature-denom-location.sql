SELECT
  dav.entity_id as location_id,
  COUNT(DISTINCT dav.id) as total_inventory_count
FROM
  datamart_assets_v5 dav final
WHERE
  dav.entity_status = 1
  AND dav.deleted_at IS NULL
  AND dav.entity_deleted_at IS NULL
  AND has(dav.asset_classifications_id, 1)
  AND dav.rtmds_qty > 0 
GROUP BY location_id