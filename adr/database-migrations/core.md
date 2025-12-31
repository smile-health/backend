# Database Migration Changelog

### `1717351399566_create-initial-table.ts`

#### Creates Table: `workspaces`

| Column Name    | Data Type       | Constraints & Properties                                               |
| -------------- | --------------- | ---------------------------------------------------------------------- |
| `id`           | `bigint`        | `autoIncrement`, `primaryKey`                                          |
| `key`          | `varchar(255)`  | `notNull`, `unique`                                                    |
| `name`         | `varchar(255)`  | `notNull`                                                              |
| `config`       | `varchar(1000)` | `defaultTo "{}"`                                                       |
| `created_at`   | `timestamp`     | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at`   | `timestamp`     | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |
| `program_uuid` | `varchar(100)`  |                                                                        |

#### Creates Table: `password_resets`

| Column Name  | Data Type      | Constraints & Properties                 |
| ------------ | -------------- | ---------------------------------------- |
| `email`      | `varchar(255)` | `notNull`, `primaryKey`                  |
| `token`      | `varchar(255)` | `notNull`                                |
| `created_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull` |

### `1726557546117_create-users-table.ts`

#### Creates Table: `users`

| Column Name           | Data Type      | Constraints & Properties                                               |
| --------------------- | -------------- | ---------------------------------------------------------------------- |
| `id`                  | `bigint`       | `autoIncrement`, `primaryKey`                                          |
| `username`            | `varchar(255)` |                                                                        |
| `password`            | `varchar(255)` |                                                                        |
| `email`               | `varchar(255)` |                                                                        |
| `firstname`           | `varchar(255)` |                                                                        |
| `lastname`            | `varchar(255)` |                                                                        |
| `date_of_birth`       | `date`         |                                                                        |
| `gender`              | `int4`         |                                                                        |
| `mobile_phone`        | `varchar(255)` |                                                                        |
| `address`             | `text`         |                                                                        |
| `role`                | `int4`         |                                                                        |
| `village_id`          | `varchar(255)` |                                                                        |
| `entity_id`           | `int4`         |                                                                        |
| `timezone_id`         | `int4`         |                                                                        |
| `token_login`         | `text`         |                                                                        |
| `status`              | `smallint`     |                                                                        |
| `last_login`          | `date`         |                                                                        |
| `last_device`         | `smallint`     |                                                                        |
| `mobile_phone_2`      | `varchar(255)` |                                                                        |
| `mobile_phone_brand`  | `varchar(255)` |                                                                        |
| `mobile_phone_model`  | `varchar(255)` |                                                                        |
| `imei_number`         | `varchar(255)` |                                                                        |
| `sim_provider`        | `varchar(255)` |                                                                        |
| `sim_id`              | `varchar(255)` |                                                                        |
| `iota_app_gui_theme`  | `varchar(255)` |                                                                        |
| `permission`          | `varchar(255)` | `defaultTo "1.0"`                                                      |
| `application_version` | `varchar(255)` |                                                                        |
| `last_mobile_access`  | `datetime`     |                                                                        |
| `view_only`           | `int4`         | `notNull`, `defaultTo 0`                                               |
| `change_password`     | `smallint`     |                                                                        |
| `manufacture_id`      | `int4`         |                                                                        |
| `fcm_token`           | `varchar(255)` |                                                                        |
| `created_by`          | `int4`         |                                                                        |
| `updated_by`          | `int4`         |                                                                        |
| `deleted_by`          | `int4`         |                                                                        |
| `created_at`          | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at`          | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |
| `keycloak_uuid`       | `varchar(50)`  |                                                                        |
| `user_uuid`           | `varchar(50)`  |                                                                        |

### `1726718687910_create-roles-table.ts`

#### Creates Table: `roles`

| Column Name  | Data Type      | Constraints & Properties                                               |
| ------------ | -------------- | ---------------------------------------------------------------------- |
| `id`         | `bigint`       | `autoIncrement`, `primaryKey`                                          |
| `name`       | `varchar(255)` | `notNull`                                                              |
| `created_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |

### `1727235270602_create-login-attempts-table.ts`

#### Creates Table: `login_attempts`

| Column Name    | Data Type      | Constraints & Properties                                               |
| -------------- | -------------- | ---------------------------------------------------------------------- |
| `id`           | `bigint`       | `autoIncrement`, `primaryKey`                                          |
| `ip`           | `varchar(255)` |                                                                        |
| `hit`          | `smallint`     |                                                                        |
| `last_attempt` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`                                          |
| `created_at`   | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at`   | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |

### `1730059034528_create-manufacture-workspaces-table.ts`

#### Creates Table: `manufacture_workspaces`

| Column Name      | Data Type   | Constraints & Properties                                               |
| ---------------- | ----------- | ---------------------------------------------------------------------- |
| `id`             | `bigint`    | `autoIncrement`, `primaryKey`                                          |
| `manufacture_id` | `bigint`    | `notNull`                                                              |
| `workspace_id`   | `bigint`    | `notNull`                                                              |
| `created_at`     | `timestamp` | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at`     | `timestamp` | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |

### `1730177385644_create-material-levels-table.ts`

#### Creates Table: `material_levels`

| Column Name  | Data Type      | Constraints & Properties                                                |
| ------------ | -------------- | ----------------------------------------------------------------------- |
| `id`         | `bigint`       | `autoIncrement`, `primaryKey`                                           |
| `name`       | `varchar(255)` | `notNull`, `unique`                                                     |
| `order`      | `varchar(255)` | `notNull`, `unique`                                                     |
| `created_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                                |
| `updated_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP`  |
| `deleted_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, then `NULL` via `ALTER TABLE` |

### `1737605465873_create-roles_to_resource_mapping-table.ts`

#### Creates Table: `roles_to_resource_mapping`

| Column Name     | Data Type          | Constraints & Properties                                               |
| --------------- | ------------------ | ---------------------------------------------------------------------- |
| `id`            | `bigint`           | `autoIncrement`, `primaryKey`                                          |
| `http_method`   | `varchar(10)`      |                                                                        |
| `route_handler` | `varchar(255)`     | `notNull`                                                              |
| `role_list`     | `text`             |                                                                        |
| `resource_type` | `enum('fe', 'be')` | `notNull`, `defaultTo 'be'`                                            |
| `status`        | `smallint`         | `notNull`, `defaultTo 1`                                               |
| `created_at`    | `timestamp`        | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at`    | `timestamp`        | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |
| `created_by`    | `varchar(50)`      | `notNull`                                                              |
| `updated_by`    | `varchar(50)`      |                                                                        |

### `1746413321412_alter-users-add-column-roleexternals.ts`

#### Alters Table: `users`

| Action       | Column Name           | Details |
| ------------ | --------------------- | ------- |
| `ADD COLUMN` | `external_properties` | `text`  |

### `1746415968097_alter-entities-add-column-for-wms.ts`

#### Alters Table: `entities`

| Action       | Column Name           | Details   |
| ------------ | --------------------- | --------- |
| `ADD COLUMN` | `integration_type`    | `integer` |
| `ADD COLUMN` | `external_properties` | `text`    |

### `1746431053122_alter-entity-types-for-wms.ts`

#### Alters Table: `entity_tags`

| Action       | Column Name           | Details   |
| ------------ | --------------------- | --------- |
| `ADD COLUMN` | `integration_type`    | `integer` |
| `ADD COLUMN` | `external_properties` | `text`    |

### `1746431066100_alter-entity-tags-for-wms.ts`

#### Alters Table: `entity_types`

| Action       | Column Name        | Details   |
| ------------ | ------------------ | --------- |
| `ADD COLUMN` | `integration_type` | `integer` |

### `1746499948016_add-status-to-budget-source-workspaces.ts`

#### Alters Table: `budget_source_workspaces`

| Action       | Column Name | Details                              |
| ------------ | ----------- | ------------------------------------ |
| `ADD COLUMN` | `status`    | `smallint`, `notNull`, `defaultTo 1` |

### `1746503312075_alter-column-material_relation-material_id.ts`

#### Alters Table: `material_relations`

| Action          | Old Column Name    | New Column Name      |
| --------------- | ------------------ | -------------------- |
| `RENAME COLUMN` | `from_material_id` | `child_material_id`  |
| `RENAME COLUMN` | `to_material_id`   | `parent_material_id` |

### `1747378994371_alter-table-material-levels-add-columns-enable.ts`

#### Alters Table: `material_levels`

| Action       | Column Name | Details                  |
| ------------ | ----------- | ------------------------ |
| `ADD COLUMN` | `enable`    | `integer`, `defaultTo 0` |

### `1730774810234_create-entity-types-table.ts`

#### Creates Table: `entity_types`

| Column Name  | Data Type      | Constraints & Properties                                                |
| ------------ | -------------- | ----------------------------------------------------------------------- |
| `id`         | `bigint`       | `autoIncrement`, `primaryKey`                                           |
| `name`       | `varchar(255)` | `notNull`                                                               |
| `created_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                                |
| `updated_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP`  |
| `deleted_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, then `NULL` via `ALTER TABLE` |

### `1730697010180_create-material-workspaces-table.ts`

#### Creates Table: `material_workspaces`

| Column Name    | Data Type | Constraints & Properties                                                                               |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `id`           | `bigint`  | `autoIncrement`, `primaryKey`                                                                          |
| `material_id`  | `bigint`  | `references 'materials.id'`, `onDelete 'restrict'`, `notNull`                                          |
| `workspace_id` | `bigint`  | `references 'workspaces.id'`, `onDelete 'restrict'`, `notNull`                                         |
| `status`       | `boolean` | `defaultTo true`                                                                                       |
| `is_open_vial` | `boolean` | `defaultTo false`                                                                                      |
| `is_addremove` | `boolean` | `defaultTo false`                                                                                      |
|                |           | Calls `addAuditColumns` (adds `created_by`, `updated_by`, `deleted_by` columns)                        |
|                |           | Calls `addTimestampColumns` (adds `created_at`, `updated_at` columns)                                  |
|                |           | Adds unique constraint `unique_constraint_material_id_workspace_id` on (`material_id`, `workspace_id`) |

### `1730699744215_create-material-relations-table.ts`

#### Creates Table: `material_relations`

| Column Name        | Data Type   | Constraints & Properties                                                                                             |
| ------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| `id`               | `bigint`    | `autoIncrement`, `primaryKey`                                                                                        |
| `from_material_id` | `bigint`    | `references 'materials.id'`, `onDelete 'restrict'`, `notNull`                                                        |
| `to_material_id`   | `bigint`    | `references 'materials.id'`, `onDelete 'restrict'`, `notNull`                                                        |
| `created_at`       | `timestamp` | `defaultTo CURRENT_TIMESTAMP`, `notNull`                                                                             |
| `updated_at`       | `timestamp` | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP`                                               |
| `deleted_at`       | `timestamp` | `defaultTo CURRENT_TIMESTAMP`, `notNull`, then `NULL` via `ALTER TABLE`                                              |
|                    |             | Adds unique constraint `unique_constraint_from_material_id_to_material_id` on (`from_material_id`, `to_material_id`) |

### `1730768228370_add_soft_delete_fields_to_manufactures.ts`

#### Alters Table: `manufactures`

| Action       | Column Name  | Details                               |
| ------------ | ------------ | ------------------------------------- |
| `ADD COLUMN` | `deleted_at` | `TIMESTAMP NULL` (after `updated_at`) |
| `ADD COLUMN` | `deleted_by` | `BIGINT NULL` (after `updated_by`)    |

### `1730774810233_create-manufacture-types-table.ts`

#### Creates Table: `manufacture_types`

| Column Name  | Data Type      | Constraints & Properties                                                |
| ------------ | -------------- | ----------------------------------------------------------------------- |
| `id`         | `bigint`       | `autoIncrement`, `primaryKey`                                           |
| `name`       | `varchar(255)` | `notNull`                                                               |
| `created_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                                |
| `updated_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP`  |
| `deleted_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, then `NULL` via `ALTER TABLE` |

### `1730187138920_create-materials-table.ts`

#### Creates Table: `materials`

| Column Name                              | Data Type          | Constraints & Properties                                                |
| ---------------------------------------- | ------------------ | ----------------------------------------------------------------------- |
| `id`                                     | `bigint`           | `autoIncrement`, `primaryKey`                                           |
| `name`                                   | `varchar(255)`     | `notNull`                                                               |
| `description`                            | `varchar(255)`     |                                                                         |
| `material_level_id`                      | `bigint`           | `references 'material_levels.id'`, `onDelete 'restrict'`, `notNull`     |
| `code`                                   | `varchar(255)`     | `notNull`, `unique`                                                     |
| `hierarchy_code`                         | `varchar(255)`     | `unique`                                                                |
| `unit_of_consumption_id`                 | `bigint`           | `references 'material_units.id'`, `onDelete 'restrict'`, `notNull`      |
| `unit_of_distribution_id`                | `bigint`           | `references 'material_units.id'`, `onDelete 'restrict'`, `notNull`      |
| `consumption_unit_per_distribution_unit` | `integer`          | `notNull`                                                               |
| `is_temperature_sensitive`               | `boolean`          | `notNull`                                                               |
| `min_retail_price`                       | `double precision` | `notNull`                                                               |
| `max_retail_price`                       | `double precision` | `notNull`                                                               |
| `min_temperature`                        | `double precision` |                                                                         |
| `max_temperature`                        | `double precision` |                                                                         |
| `material_type_id`                       | `bigint`           | `references 'material_types.id'`, `onDelete 'restrict'`, `notNull`      |
| `is_managed_in_batch`                    | `boolean`          | `notNull`                                                               |
| `status`                                 | `boolean`          | `notNull`                                                               |
| `created_by`                             | `bigint`           | `references 'users.id'`, `onDelete 'restrict'`, `notNull`               |
| `updated_by`                             | `bigint`           | `references 'users.id'`, `onDelete 'restrict'`, `notNull`               |
| `deleted_by`                             | `bigint`           | `references 'users.id'`, `onDelete 'restrict'`                          |
| `created_at`                             | `timestamp`        | `defaultTo CURRENT_TIMESTAMP`, `notNull`                                |
| `updated_at`                             | `timestamp`        | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP`  |
| `deleted_at`                             | `timestamp`        | `defaultTo CURRENT_TIMESTAMP`, `notNull`, then `NULL` via `ALTER TABLE` |

### `1730697010180_create-material-workspaces-table.ts`

#### Creates Table: `material_workspaces`

| Column Name    | Data Type | Constraints & Properties                                                                               |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `id`           | `bigint`  | `autoIncrement`, `primaryKey`                                                                          |
| `material_id`  | `bigint`  | `references 'materials.id'`, `onDelete 'restrict'`, `notNull`                                          |
| `workspace_id` | `bigint`  | `references 'workspaces.id'`, `onDelete 'restrict'`, `notNull`                                         |
| `status`       | `boolean` | `defaultTo true`                                                                                       |
| `is_open_vial` | `boolean` | `defaultTo false`                                                                                      |
| `is_addremove` | `boolean` | `defaultTo false`                                                                                      |
|                |           | Calls `addAuditColumns` (adds `created_by`, `updated_by`, `deleted_by` columns)                        |
|                |           | Calls `addTimestampColumns` (adds `created_at`, `updated_at` columns)                                  |
|                |           | Adds unique constraint `unique_constraint_material_id_workspace_id` on (`material_id`, `workspace_id`) |

### `1730183368423_create-material_units-table.ts`

#### Creates Table: `material_units`

| Column Name  | Data Type      | Constraints & Properties                                                |
| ------------ | -------------- | ----------------------------------------------------------------------- |
| `id`         | `bigint`       | `autoIncrement`, `primaryKey`                                           |
| `name`       | `varchar(255)` | `notNull`, `unique`                                                     |
| `type`       | `varchar(255)` | `notNull`                                                               |
| `created_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                                |
| `updated_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP`  |
| `deleted_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, then `NULL` via `ALTER TABLE` |

### `1730183368223_create-material-types-table.ts`

#### Creates Table: `material_types`

| Column Name  | Data Type      | Constraints & Properties                                                |
| ------------ | -------------- | ----------------------------------------------------------------------- |
| `id`         | `bigint`       | `autoIncrement`, `primaryKey`                                           |
| `name`       | `varchar(255)` | `notNull`, `unique`                                                     |
| `created_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                                |
| `updated_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP`  |
| `deleted_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, then `NULL` via `ALTER TABLE` |

### `1729135731730_create-budget-sources.ts`

#### Creates Table: `budget_sources`

| Column Name   | Data Type      | Constraints & Properties                                               |
| ------------- | -------------- | ---------------------------------------------------------------------- |
| `id`          | `bigint`       | `autoIncrement`, `primaryKey`                                          |
| `name`        | `varchar(255)` | `notNull`                                                              |
| `description` | `varchar(255)` |                                                                        |
| `created_by`  | `bigint`       |                                                                        |
| `updated_by`  | `bigint`       |                                                                        |
| `created_at`  | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at`  | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |

### `1729135742973_create-budget-source-workspaces.ts`

#### Creates Table: `budget_source_workspaces`

| Column Name        | Data Type   | Constraints & Properties                                               |
| ------------------ | ----------- | ---------------------------------------------------------------------- |
| `id`               | `bigint`    | `autoIncrement`, `primaryKey`                                          |
| `budget_source_id` | `bigint`    | `notNull`                                                              |
| `workspace_id`     | `integer`   |                                                                        |
| `created_at`       | `timestamp` | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at`       | `timestamp` | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |

### `1730058345481_create-manufactures-table.ts`

#### Creates Table: `manufactures`

| Column Name    | Data Type      | Constraints & Properties                                               |
| -------------- | -------------- | ---------------------------------------------------------------------- |
| `id`           | `bigint`       | `autoIncrement`, `primaryKey`                                          |
| `name`         | `varchar(255)` | `notNull`                                                              |
| `type`         | `integer`      | `notNull`                                                              |
| `reference_id` | `varchar(255)` |                                                                        |
| `description`  | `varchar(255)` |                                                                        |
| `contact_name` | `varchar(255)` |                                                                        |
| `phone_number` | `varchar(20)`  |                                                                        |
| `email`        | `varchar(255)` |                                                                        |
| `address`      | `varchar(255)` |                                                                        |
| `status`       | `integer`      |                                                                        |
| `created_by`   | `bigint`       |                                                                        |
| `updated_by`   | `bigint`       |                                                                        |
| `created_at`   | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at`   | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |

### `1726815809265_create-entity-workspaces-table.ts`

#### Creates Table: `entity_workspaces`

| Column Name    | Data Type | Constraints & Properties                                                                                                                                                     |
| -------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | `bigint`  | `autoIncrement`, `primaryKey`                                                                                                                                                |
| `entity_id`    | `bigint`  |                                                                                                                                                                              |
| `workspace_id` | `bigint`  |                                                                                                                                                                              |
| `status`       | `boolean` | `defaultTo true`                                                                                                                                                             |
| `is_vendor`    | `boolean` | `defaultTo false`                                                                                                                                                            |
|                |           | Calls `addTimestampColumns` (adds `created_at`, `updated_at` columns)                                                                                                        |
|                |           | Calls `addAuditColumns` (adds `created_by`, `updated_by`, `deleted_by` columns)                                                                                              |
|                |           | Adds unique constraint `unique_constraint_material_id_workspace_id` on (`material_id`, `workspace_id`) (Note: `material_id` seems like a typo, likely should be `entity_id`) |

### `1726729801454_create-user-workspaces-table.ts`

#### Creates Table: `user_workspaces`

| Column Name    | Data Type   | Constraints & Properties                                               |
| -------------- | ----------- | ---------------------------------------------------------------------- |
| `id`           | `bigint`    | `autoIncrement`, `primaryKey`                                          |
| `user_id`      | `bigint`    | `notNull`                                                              |
| `workspace_id` | `integer`   | `notNull`                                                              |
| `status`       | `boolean`   | `defaultTo true`                                                       |
| `created_at`   | `timestamp` | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at`   | `timestamp` | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |

### `1726751342464_create-entities-table.ts`

#### Creates Table: `entities`

| Column Name       | Data Type      | Constraints & Properties                                              |
| ----------------- | -------------- | --------------------------------------------------------------------- |
| `id`              | `bigint`       | `autoIncrement`, `primaryKey`                                         |
| `code`            | `varchar(255)` |                                                                       |
| `name`            | `varchar(255)` |                                                                       |
| `type`            | `smallint`     | `notNull`, `defaultTo 1`                                              |
| `status`          | `smallint`     | `notNull`, `defaultTo 1`                                              |
| `entity_tag_id`   | `bigint`       |                                                                       |
| `address`         | `text`         |                                                                       |
| `country`         | `varchar(255)` |                                                                       |
| `province_id`     | `varchar(255)` |                                                                       |
| `regency_id`      | `varchar(255)` |                                                                       |
| `sub_district_id` | `varchar(255)` |                                                                       |
| `village_id`      | `varchar(255)` |                                                                       |
| `postal_code`     | `varchar(255)` |                                                                       |
| `lat`             | `varchar(255)` |                                                                       |
| `lng`             | `varchar(255)` |                                                                       |
| `is_puskesmas`    | `smallint`     | `notNull`, `defaultTo 0`                                              |
| `is_vendor`       | `smallint`     | `notNull`, `defaultTo 0`                                              |
| `id_satu_sehat`   | `bigint`       |                                                                       |
| `created_by`      | `bigint`       |                                                                       |
| `updated_by`      | `bigint`       |                                                                       |
|                   |                | Calls `addTimestampColumns` (adds `created_at`, `updated_at` columns) |

### `1726751342465_create-entity-tags-table.ts`

#### Creates Table: `entity_tags`

| Column Name  | Data Type      | Constraints & Properties                                               |
| ------------ | -------------- | ---------------------------------------------------------------------- |
| `id`         | `bigint`       | `autoIncrement`, `primaryKey`                                          |
| `title`      | `varchar(255)` |                                                                        |
| `created_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |

### `1726719036782_create-user-changelogs-table.ts`

#### Creates Table: `user_changelogs`

| Column Name  | Data Type      | Constraints & Properties                                               |
| ------------ | -------------- | ---------------------------------------------------------------------- |
| `id`         | `bigint`       | `primaryKey`                                                           |
| `user_id`    | `bigint`       | `notNull`                                                              |
| `field`      | `varchar(255)` | `notNull`                                                              |
| `old_value`  | `varchar(255)` |                                                                        |
| `new_value`  | `varchar(255)` |                                                                        |
| `created_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |

### `1726718802886_create-locations-table.ts`

#### Creates Table: `locations`

| Column Name  | Data Type      | Constraints & Properties                                               |
| ------------ | -------------- | ---------------------------------------------------------------------- |
| `id`         | `bigint`       | `primaryKey`                                                           |
| `parent_id`  | `bigint`       |                                                                        |
| `name`       | `varchar(255)` | `notNull`                                                              |
| `lat`        | `varchar(255)` |                                                                        |
| `lng`        | `varchar(255)` |                                                                        |
| `level`      | `smallint`     | `defaultTo 0`                                                          |
| `created_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`                               |
| `updated_at` | `timestamp`    | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP` |
