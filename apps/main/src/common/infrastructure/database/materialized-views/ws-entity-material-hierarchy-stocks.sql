CREATE TABLE ws_entity_material_hierarchy_stocks on cluster '{cluster}'
(
    `program_id` Int64,
    `entity_id` Int64,
    `material_id` Int64,
    `min` Nullable(Float64),
    `max` Nullable(Float64),
    `total_qty` Nullable(Float64),
    `total_in_transit_qty` Nullable(Float64),
    `total_allocated_qty` Nullable(Float64),
    `total_open_vial_qty` Nullable(Float64),
    `total_exterminated_qty` Nullable(Float64),
    `total_available_qty` Nullable(Float64),
    `updated_at` DateTime
)
ENGINE = ReplacingMergeTree
ORDER BY (`program_id`, `entity_id`, `material_id`, `updated_at`);

CREATE MATERIALIZED VIEW IF NOT EXISTS ws_entity_material_hierarchy_stocks_view on cluster '{cluster}'
REFRESH EVERY 30 SECONDS APPEND TO ws_entity_material_hierarchy_stocks AS
select
    a.program_id AS program_id,
    s.entity_id AS entity_id,
    s.parent_material_id AS material_id,
    0 AS min,
    0 AS max,
    coalesce(sum(s.qty), 0) AS total_qty,
    coalesce(sum(s.in_transit_qty), 0) AS total_in_transit_qty,
    coalesce(sum(s.allocated_qty), 0) AS total_allocated_qty,
    coalesce(sum(s.open_vial_qty), 0) AS total_open_vial_qty,
    coalesce(sum(s.exterminated_qty), 0) AS total_exterminated_qty,
    coalesce(sum(s.qty - s.allocated_qty), 0) AS total_available_qty,
    max(s.updated_at) AS updated_at
from ws_stocks s
join ws_activities a on a.id = s.activity_id
where
    s.parent_material_id is not null
and tuple(s.entity_id, s.parent_material_id) in (
	SELECT DISTINCT entity_id, parent_material_id FROM ws_stocks
	WHERE updated_at >= now() - INTERVAL 30 SECONDS
)
group by
    a.program_id,
    s.entity_id,
    s.parent_material_id
ORDER BY updated_at;