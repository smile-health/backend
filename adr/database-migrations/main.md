# Main App Database Migration Changelog

### `1734082027819_create-ws-material-relations.ts`

#### Creates Table: `ws_material_permissions`

| Column Name   | Data Type      | Constraints & Properties      |
| ------------- | -------------- | ----------------------------- |
| `id`          | `bigint`       | `autoIncrement`, `primaryKey` |
| `material_id` | `bigint`       | `notNull`                     |
| `action`      | `integer`      | `notNull`                     |
| `key`         | `varchar(255)` | `notNull`                     |
| `value`       | `integer`      | `notNull`                     |
|               |                | Calls `addTimestampColumns`   |

#### Creates Table: `ws_material_companions`

| Column Name    | Data Type | Constraints & Properties      |
| -------------- | --------- | ----------------------------- |
| `id`           | `bigint`  | `autoIncrement`, `primaryKey` |
| `material_id`  | `bigint`  | `notNull`                     |
| `companion_id` | `bigint`  | `notNull`                     |
|                |           | Calls `addTimestampColumns`   |

#### Creates Table: `ws_material_manufactures`

| Column Name      | Data Type | Constraints & Properties      |
| ---------------- | --------- | ----------------------------- |
| `id`             | `bigint`  | `autoIncrement`, `primaryKey` |
| `material_id`    | `bigint`  | `notNull`                     |
| `manufacture_id` | `bigint`  | `notNull`                     |
|                  |           | Calls `addTimestampColumns`   |

#### Creates Table: `ws_material_activities`

| Column Name   | Data Type | Constraints & Properties      |
| ------------- | --------- | ----------------------------- |
| `id`          | `bigint`  | `autoIncrement`, `primaryKey` |
| `material_id` | `bigint`  | `notNull`                     |
| `activity_id` | `bigint`  | `notNull`                     |
| `is_sequence` | `boolean` | `defaultTo false`             |
|               |           | Calls `addTimestampColumns`   |

### `1734313067613_create-ws-activities-and-relations.ts`

#### Creates Table: `ws_activities`

| Column Name           | Data Type      | Constraints & Properties      |
| --------------------- | -------------- | ----------------------------- |
| `id`                  | `bigint`       | `autoIncrement`, `primaryKey` |
| `program_id`          | `integer`      | `notNull`                     |
| `name`                | `varchar(255)` | `notNull`                     |
| `is_ordered_sales`    | `boolean`      | `defaultTo false`             |
| `is_ordered_purchase` | `boolean`      | `defaultTo false`             |
|                       |                | Calls `addAuditColumns`       |
|                       |                | Calls `addTimestampColumns`   |

#### Creates Table: `ws_activity_material_types`

| Column Name        | Data Type | Constraints & Properties    |
| ------------------ | --------- | --------------------------- |
| `activity_id`      | `bigint`  | `notNull`                   |
| `material_type_id` | `integer` | `notNull`                   |
| `is_patient`       | `boolean` | `defaultTo false`           |
|                    |           | Calls `addTimestampColumns` |

### `1734503371509_create-ws-entity-relations.ts`

#### Creates Table: `ws_entity_activities`

| Column Name   | Data Type  | Constraints & Properties    |
| ------------- | ---------- | --------------------------- |
| `entity_id`   | `bigint`   | `notNull`                   |
| `activity_id` | `bigint`   | `notNull`                   |
| `start_date`  | `datetime` |                             |
| `end_date`    | `datetime` |                             |
|               |            | Calls `addTimestampColumns` |

#### Creates Table: `ws_entity_material_activities`

| Column Name        | Data Type          | Constraints & Properties      |
| ------------------ | ------------------ | ----------------------------- |
| `id`               | `bigint`           | `autoIncrement`, `primaryKey` |
| `entity_id`        | `bigint`           | `notNull`                     |
| `material_id`      | `bigint`           | `notNull`                     |
| `activity_id`      | `bigint`           | `notNull`                     |
| `min`              | `double precision` | `defaultTo 0`                 |
| `max`              | `double precision` | `defaultTo 0`                 |
| `consumption_rate` | `double precision` | `defaultTo 0`                 |
| `retailer_price`   | `double precision` | `defaultTo 0`                 |
| `tax`              | `double precision` | `defaultTo 0`                 |
|                    |                    | Calls `addTimestampColumns`   |
|                    |                    | Calls `addAuditColumns`       |

#### Creates Table: `ws_customer_vendors`

| Column Name        | Data Type | Constraints & Properties      |
| ------------------ | --------- | ----------------------------- |
| `id`               | `bigint`  | `autoIncrement`, `primaryKey` |
| `program_id`       | `integer` | `notNull`                     |
| `customer_id`      | `bigint`  | `notNull`                     |
| `vendor_id`        | `bigint`  | `notNull`                     |
| `is_distribution`  | `boolean` | `defaultTo false`             |
| `is_consumption`   | `boolean` | `defaultTo false`             |
| `is_extermination` | `boolean` | `defaultTo false`             |
|                    |           | Calls `addTimestampColumns`   |

#### Creates Table: `ws_customer_vendor_activities`

| Column Name          | Data Type | Constraints & Properties    |
| -------------------- | --------- | --------------------------- |
| `customer_vendor_id` | `bigint`  | `notNull`                   |
| `activity_id`        | `bigint`  | `notNull`                   |
|                      |           | Calls `addTimestampColumns` |

### `1734578937185_create-ws-stocks-and-relations.ts`

#### Creates Table: `ws_stocks`

| Column Name          | Data Type          | Constraints & Properties      |
| -------------------- | ------------------ | ----------------------------- |
| `id`                 | `bigint`           | `autoIncrement`, `primaryKey` |
| `batch_id`           | `bigint`           |                               |
| `entity_id`          | `bigint`           | `notNull`                     |
| `material_id`        | `bigint`           | `notNull`                     |
| `parent_material_id` | `bigint`           |                               |
| `activity_id`        | `bigint`           | `notNull`                     |
| `budget_source_id`   | `bigint`           |                               |
| `qty`                | `double precision` | `notNull`                     |
| `allocated_qty`      | `double precision` | `defaultTo 0`                 |
| `in_transit_qty`     | `double precision` | `defaultTo 0`                 |
| `unreceived_qty`     | `double precision` | `defaultTo 0`                 |
| `exterminated_qty`   | `double precision` | `defaultTo 0`                 |
| `open_vial_qty`      | `double precision` | `defaultTo 0`                 |
| `status`             | `smallint`         |                               |
| `year`               | `smallint`         |                               |
| `price`              | `double precision` | `defaultTo 0`                 |
| `total_price`        | `double precision` | `defaultTo 0`                 |
|                      |                    | Calls `addAuditColumns`       |
|                      |                    | Calls `addTimestampColumns`   |

#### Creates Table: `ws_stock_exterminations`

| Column Name                  | Data Type          | Constraints & Properties      |
| ---------------------------- | ------------------ | ----------------------------- |
| `id`                         | `bigint`           | `autoIncrement`, `primaryKey` |
| `stock_id`                   | `bigint`           |                               |
| `transaction_reason_id`      | `integer`          |                               |
| `extermination_discard_qty`  | `double precision` | `defaultTo 0`                 |
| `extermination_received_qty` | `double precision` | `defaultTo 0`                 |
|                              |                    | Calls `addAuditColumns`       |
|                              |                    | Calls `addTimestampColumns`   |

### `1734579110106_create-ws-transactions-and-relations.ts`

#### Creates Table: `ws_transactions`

| Column Name               | Data Type          | Constraints & Properties      |
| ------------------------- | ------------------ | ----------------------------- |
| `id`                      | `bigint`           | `autoIncrement`, `primaryKey` |
| `activity_id`             | `bigint`           |                               |
| `entity_activity_id`      | `bigint`           |                               |
| `opening_qty`             | `double precision` | `defaultTo 0`                 |
| `change_qty`              | `double precision` | `defaultTo 0`                 |
| `transaction_type_id`     | `bigint`           |                               |
| `transaction_reason_id`   | `bigint`           |                               |
| `entity_id`               | `bigint`           |                               |
| `companion_entity_id`     | `bigint`           |                               |
| `stock_id`                | `bigint`           |                               |
| `order_id`                | `bigint`           |                               |
| `batch_code`              | `varchar(255)`     |                               |
| `device_type`             | `smallint`         |                               |
| `commit_datetime`         | `datetime`         |                               |
| `actual_transaction_date` | `datetime`         |                               |
|                           |                    | Calls `addAuditColumns`       |
|                           |                    | Calls `addTimestampColumns`   |

#### Creates Table: `ws_purchases`

| Column Name        | Data Type          | Constraints & Properties      |
| ------------------ | ------------------ | ----------------------------- |
| `id`               | `bigint`           | `autoIncrement`, `primaryKey` |
| `source_id`        | `bigint`           |                               |
| `source_type`      | `varchar(255)`     |                               |
| `budget_source_id` | `bigint`           |                               |
| `year`             | `integer`          |                               |
| `price`            | `double precision` |                               |
| `total_price`      | `double precision` |                               |
|                    |                    | Calls `addAuditColumns`       |
|                    |                    | Calls `addTimestampColumns`   |

#### Creates Table: `ws_transaction_reasons`

| Column Name           | Data Type      | Constraints & Properties      |
| --------------------- | -------------- | ----------------------------- |
| `id`                  | `bigint`       | `autoIncrement`, `primaryKey` |
| `program_id`          | `integer`      | `notNull`                     |
| `title`               | `varchar(255)` |                               |
| `title_en`            | `varchar(255)` |                               |
| `transaction_type_id` | `integer`      |                               |
| `is_other`            | `boolean`      |                               |
| `is_purchase`         | `boolean`      |                               |
|                       |                | Calls `addAuditColumns`       |
|                       |                | Calls `addTimestampColumns`   |

#### Creates Table: `ws_transaction_types`

| Column Name   | Data Type      | Constraints & Properties      |
| ------------- | -------------- | ----------------------------- |
| `id`          | `bigint`       | `autoIncrement`, `primaryKey` |
| `title`       | `varchar(255)` |                               |
| `title_en`    | `varchar(255)` |                               |
| `change_type` | `varchar(50)`  |                               |
| `enable`      | `integer`      |                               |
|               |                | Calls `addAuditColumns`       |
|               |                | Calls `addTimestampColumns`   |

### `1734937962722_create-ws-batches.ts`

#### Creates Table: `ws_batches`

| Column Name       | Data Type      | Constraints & Properties      |
| ----------------- | -------------- | ----------------------------- |
| `id`              | `bigint`       | `autoIncrement`, `primaryKey` |
| `manufacture_id`  | `bigint`       | `notNull`                     |
| `code`            | `varchar(255)` | `notNull`                     |
| `production_date` | `datetime`     |                               |
| `expired_date`    | `datetime`     |                               |
| `status`          | `boolean`      | `defaultTo true`              |
|                   |                | Calls `addTimestampColumns`   |
