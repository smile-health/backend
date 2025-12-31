# Sync Service Database Migration Changelog

### `1737703331081_create-table-logger.ts`

#### Creates Table: `logger`

| Column Name  | Data Type   | Constraints & Properties                                                |
| ------------ | ----------- | ----------------------------------------------------------------------- |
| `id`         | `bigint`    | `autoIncrement`, `primaryKey`                                           |
| `text`       | `text`      |                                                                         |
| `created_at` | `timestamp` | `defaultTo CURRENT_TIMESTAMP`, `notNull`                                |
| `updated_at` | `timestamp` | `defaultTo CURRENT_TIMESTAMP`, `notNull`, `onUpdate CURRENT_TIMESTAMP`  |
| `deleted_at` | `timestamp` | `defaultTo CURRENT_TIMESTAMP`, `notNull`, later altered to allow `NULL` |

### `1739266925813_create-table-mapping-entity-material-activities.ts`

#### Creates Table: `mapping_entity_material_activities`

| Column Name                                       | Data Type | Constraints & Properties      |
| ------------------------------------------------- | --------- | ----------------------------- |
| `id`                                              | `bigint`  | `autoIncrement`, `primaryKey` |
| `program_id`                                      | `bigint`  | `notNull`                     |
| `platform_entity_material_activity_id`            | `bigint`  | `notNull`                     |
| `existing_entity_material_activity_id`            | `bigint`  | `notNull`                     |
| `existing_entity_material_id`                     | `bigint`  | `notNull`                     |
| All timestamp columns added via a helper function |

#### Creates Index: `idx_mapping_entity_material_activities_platform_ema_id` on `mapping_entity_material_activities`

Columns: `platform_entity_material_activity_id`

### `1739266925814_create-table-mapping-multiple.ts`

#### Creates Multiple Mapping Tables

Tables created: mapping_activities, mapping_budget_sources, mapping_manufactures, mapping_entities, mapping_materials, mapping_users, mapping_batches, mapping_stocks, mapping_stock_exterminations, mapping_orders, mapping_order_items, mapping_transactions, mapping_patients, mapping_transaction_reasons

| Column Name                                 | Data Type | Constraints & Properties      |
| ------------------------------------------- | --------- | ----------------------------- |
| `id`                                        | `bigint`  | `autoIncrement`, `primaryKey` |
| `program_id`                                | `bigint`  | `notNull`                     |
| `platform_<singular>_id`                    | `bigint`  | `notNull`                     |
| `existing_<singular>_id`                    | `bigint`  | `notNull`                     |
| Timestamp columns added via helper function |

Indexes created per table on columns: `platform_<singular>_id`, `program_id`

### `1745225936413_create-table-mapping-multiple.ts`

#### Creates Table: `mapping_order_comments`

| Column Name                                 | Data Type | Constraints & Properties      |
| ------------------------------------------- | --------- | ----------------------------- |
| `id`                                        | `bigint`  | `autoIncrement`, `primaryKey` |
| `program_id`                                | `bigint`  | `notNull`                     |
| `platform_order_comment_id`                 | `bigint`  | `notNull`                     |
| `existing_order_comment_id`                 | `bigint`  | `notNull`                     |
| Timestamp columns added via helper function |

Indexes created on columns: `platform_order_comment_id`, `program_id`

### `1745564849619_add-column-to-mapping-activities.ts`

#### Alters Table: `mapping_activities`

| Action       | Column Name           | Details   |
| ------------ | --------------------- | --------- |
| `ADD COLUMN` | `existing_program_id` | `integer` |

### `1746512670602_create-table-mapping_order_stocks.ts`

#### Creates Table: `mapping_order_stocks`

| Column Name                                 | Data Type | Constraints & Properties      |
| ------------------------------------------- | --------- | ----------------------------- |
| `id`                                        | `bigint`  | `autoIncrement`, `primaryKey` |
| `program_id`                                | `bigint`  | `notNull`                     |
| `platform_order_item_stock_id`              | `bigint`  | `notNull`                     |
| `platform_stock_id`                         | `bigint`  | `notNull`                     |
| `existing_order_stock_id`                   | `bigint`  | `notNull`                     |
| Timestamp columns added via helper function |

#### Creates Index: `idx_mapping_order_stocks_platform_order_item_stock_id`

Columns: `platform_order_item_stock_id`, `platform_stock_id`

### `1746759458000_add-platform-global-id-columns.ts`

#### Alters Tables: `mapping_users`, `mapping_entities`, `mapping_budget_sources`, `mapping_manufactures`, `mapping_materials`

| Action       | Column Name          | Details  |
| ------------ | -------------------- | -------- |
| `ADD COLUMN` | `platform_global_id` | `bigint` |

### `1746759458001_create_table_mapping_programs.ts`

#### Creates Table: `mapping_programs`

| Column Name                                 | Data Type | Constraints & Properties      |
| ------------------------------------------- | --------- | ----------------------------- |
| `id`                                        | `bigint`  | `autoIncrement`, `primaryKey` |
| `platform_program_id`                       | `bigint`  | `notNull`                     |
| `existing_program_id`                       | `bigint`  | `notNull`                     |
| Timestamp columns added via helper function |

#### Creates Index: `idx_mapping_programs_platform_program_id`

Columns: `platform_program_id`

### `1747104168654_add-unique-constraint-multiple.ts`

#### Alters Tables: `mapping_users`, `mapping_entities`, `mapping_budget_sources`, `mapping_manufactures`, `mapping_materials`

| Action                  | Constraint Name             | Columns                            |
| ----------------------- | --------------------------- | ---------------------------------- |
| `ADD UNIQUE CONSTRAINT` | `<table>_program_id_unique` | `platform_global_id`, `program_id` |
