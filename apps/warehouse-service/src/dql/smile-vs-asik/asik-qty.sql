SELECT
  a.region_id,
  a.zone_id,
  a.pcare_qty,
  a.injection_date
FROM
  (
    SELECT
      d.vendor_id AS region_id,
      rwe.regency_id AS zone_id,
      sum(coalesce(d.aggregate, 0)) AS pcare_qty,
      argMax(d.injection_date, d.id) AS injection_date
    FROM
      raw_integration_asik_aggregate AS d
    INNER JOIN raw_entities AS rwe ON rwe.id = d.vendor_id
    WHERE
      d.deleted_at IS NULL
      AND d.injection_date IS NOT NULL
      AND d.material_id = ${masterMaterialId}
      AND d.injection_date BETWEEN toDate(${start_date}) AND toDate(${end_date})
    GROUP BY
      region_id,
      zone_id
  ) AS a