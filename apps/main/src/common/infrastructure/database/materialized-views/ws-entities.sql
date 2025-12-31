CREATE TABLE ws_entities on cluster '{cluster}'
(
    `id` Int64,
    `global_id` Int64,
    `program_id` Int64,
    `status` Nullable(Int8),
    `id_satu_sehat` Nullable(Int64),
    `entity_tag_id` Nullable(Int64),
    `is_open_vial` Nullable(Int8),
    `code` Nullable(String),
    `type` Int16,
    `name` Nullable(String),
    `address` Nullable(String),
    `country` Nullable(String),
    `village_id` Nullable(Int64),
    `province_id` Nullable(Int64),
    `regency_id` Nullable(Int64),
    `sub_district_id` Nullable(Int64),
    `postal_code` Nullable(String),
    `lat` Nullable(String),
    `lng` Nullable(String),
    `is_puskesmas` Int16,
    `is_vendor` Nullable(Int8),
    `created_by` Nullable(Int64),
    `updated_by` Nullable(Int64),
    `created_at` DateTime,
    `updated_at` DateTime,
    `deleted_at` Nullable(DateTime)
)
ENGINE = ReplacingMergeTree
ORDER BY (`id`);

CREATE MATERIALIZED VIEW IF NOT EXISTS ws_entities_view on cluster '{cluster}'
REFRESH EVERY 30 SECONDS APPEND TO ws_entities AS
select
    `ew`.`id` AS `id`,
    `e`.`id` AS `global_id`,
    `ew`.`workspace_id` AS `program_id`,
    `ew`.`status` AS `status`,
    `e`.`id_satu_sehat` AS `id_satu_sehat`,
    `e`.`entity_tag_id` AS `entity_tag_id`,
    `et`.`is_open_vial` AS `is_open_vial`,
    `e`.`code` AS `code`,
    `e`.`type` AS `type`,
    `e`.`name` AS `name`,
    `e`.`address` AS `address`,
    `e`.`country` AS `country`,
    `e`.`village_id` AS `village_id`,
    `e`.`province_id` AS `province_id`,
    `e`.`regency_id` AS `regency_id`,
    `e`.`sub_district_id` AS `sub_district_id`,
    `e`.`postal_code` AS `postal_code`,
    `e`.`lat` AS `lat`,
    `e`.`lng` AS `lng`,
    `e`.`is_puskesmas` AS `is_puskesmas`,
    `ew`.`is_vendor` AS `is_vendor`,
    `e`.`created_by` AS `created_by`,
    `e`.`updated_by` AS `updated_by`,
    `e`.`created_at` AS `created_at`,
    `e`.`updated_at` AS `updated_at`,
    `e`.`deleted_at` AS `deleted_at`
from
    `entity_workspaces` `ew`
left join `entities` `e` on
    (`e`.`id` = `ew`.`entity_id`)
join `entity_tags` `et` on
    (`et`.`id` = `e`.`entity_tag_id`)
where ew.id > (SELECT max(id) FROM ws_entities)
order by ew.id;

insert into ws_entities
select
    `ew`.`id` AS `id`,
    `e`.`id` AS `global_id`,
    `ew`.`workspace_id` AS `program_id`,
    `ew`.`status` AS `status`,
    `e`.`id_satu_sehat` AS `id_satu_sehat`,
    `e`.`entity_tag_id` AS `entity_tag_id`,
    `et`.`is_open_vial` AS `is_open_vial`,
    `e`.`code` AS `code`,
    `e`.`type` AS `type`,
    `e`.`name` AS `name`,
    `e`.`address` AS `address`,
    `e`.`country` AS `country`,
    `e`.`village_id` AS `village_id`,
    `e`.`province_id` AS `province_id`,
    `e`.`regency_id` AS `regency_id`,
    `e`.`sub_district_id` AS `sub_district_id`,
    `e`.`postal_code` AS `postal_code`,
    `e`.`lat` AS `lat`,
    `e`.`lng` AS `lng`,
    `e`.`is_puskesmas` AS `is_puskesmas`,
    `ew`.`is_vendor` AS `is_vendor`,
    `e`.`created_by` AS `created_by`,
    `e`.`updated_by` AS `updated_by`,
    `e`.`created_at` AS `created_at`,
    `e`.`updated_at` AS `updated_at`,
    `e`.`deleted_at` AS `deleted_at`
from
    `entity_workspaces` `ew`
join `entities` `e` on
    (`e`.`id` = `ew`.`entity_id`)
join `entity_tags` `et` on
    (`et`.`id` = `e`.`entity_tag_id`);
