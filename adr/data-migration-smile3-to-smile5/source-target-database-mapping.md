# SMILE 3.0 to 5.0 Database Migration - Source and Target Mapping

## Overview

This document provides a comprehensive mapping of source databases (SMILE 3.0) to target databases (SMILE 5.0) for the data migration process.

## Database Configuration

### Source Databases (SMILE 3.0)

| Program ID | Database | Environment Variable | Description |
|------------|----------|---------------------|-------------|
| 1 | IMUN_DB | `IMUN_DB_NAME` | Immunization program database |
| 2 | LOGISTIK_DB | `LOGISTIK_DB_NAME` | Logistics program database |

### Target Databases (SMILE 5.0)

| Database | Environment Variable | Description |
|----------|---------------------|-------------|
| PLATFORM_DB | `PLATFORM_DB_NAME` | Main platform database |
| MIGRATION_DB | `MIGRATION_DB_NAME` | Migration tracking database |

## Global Migration Mappings

### Location Migration
- **Source**: `provinces`, `regencies`, `sub_districts`, `villages`
- **Target**: `locations`
- **Script**: `global/migrate-location.ts`

### Activity Migration
- **Source**: `master_activities`
- **Target**: `ws_activities`
- **Mapping Table**: `mapping_activities`
- **Script**: `global/migrate-activity.ts`

### User Migration
- **Source**: `users`
- **Target**: `users`, `user_workspaces`
- **Mapping Table**: `mapping_users`
- **Script**: `global/migrate-user-bulk.ts`

### Entity Migration
- **Source**: `entities`, `entity_entity_tags`
- **Target**: `entities`, `entity_workspaces`
- **Mapping Table**: `mapping_entities`
- **Script**: `global/migrate-entity-bulk.ts`

### Material Migration
- **Source**: `master_materials`
- **Target**: `materials`, `material_workspaces`, `material_relations`
- **Mapping Table**: `mapping_materials`
- **Script**: `global/migrate-material.ts`

### Manufacture Migration
- **Source**: `manufactures`
- **Target**: `manufactures`, `manufacture_workspaces`
- **Mapping Table**: `mapping_manufactures`
- **Script**: `global/migrate-manufacture.ts`

### Budget Source Migration
- **Source**: `budget_sources`
- **Target**: `budget_sources`, `budget_source_workspaces`
- **Mapping Table**: `mapping_budget_sources`
- **Script**: `global/migrate-budget-source.ts`

## Workspace-Specific Migration Mappings

### Patient Migration
- **Source**: `patients`
- **Target**: `ws_patients`
- **Mapping Table**: `mapping_patients`
- **Script**: `workspace/migrate-patients.ts`

### Stock Migration
- **Source**: `stocks`, `entity_has_master_materials`
- **Target**: `ws_stocks`
- **Mapping Table**: `mapping_stocks`
- **Script**: `workspace/migrate-stock/stocks.ts`

### Batch Migration
- **Source**: `batches`
- **Target**: `ws_batches`
- **Mapping Table**: `mapping_batches`
- **Script**: `workspace/migrate-batches.ts`

### Order Migration
- **Source**: `orders`, `order_items`, `order_histories`, `order_comments`
- **Target**: `ws_orders`, `ws_order_items`, `ws_order_histories`, `ws_order_comments`
- **Mapping Tables**: `mapping_orders`, `mapping_order_items`
- **Script**: `workspace/migrate-order/index.ts`

### Transaction Migration
- **Source**: `transactions`, `purchases`, `consumptions`
- **Target**: `ws_transactions`
- **Mapping Table**: `mapping_transactions`
- **Script**: `workspace/migrate-transaction/index.ts`

### Transaction Reasons Migration
- **Source**: `transaction_reasons`
- **Target**: `ws_transaction_reasons`
- **Mapping Table**: `mapping_transaction_reasons`
- **Script**: `workspace/migrate-transaction-reasons.ts`

### Stock Opname Migration
- **Source**: `stock_opnames`
- **Target**: `ws_stock_opnames`
- **Mapping Table**: `mapping_stock_opnames`
- **Script**: `workspace/migrate-stock-opnames.ts`

### Reconciliation Migration
- **Source**: `reconciliations`
- **Target**: `ws_reconciliations`
- **Mapping Table**: `mapping_reconciliations`
- **Script**: `workspace/migrate-reconciliations.ts`

### Entity Relations Migration
- **Source**: `customer_vendors`, `entity_activities`, `entity_material_activities`
- **Target**: `ws_entity_activities`, `ws_entity_material_activities`
- **Script**: `workspace/migrate-entity/index.ts`

### Material Relations Migration
- **Source**: `material_activities`, `material_companions`, `material_conditions`, `material_manufactures`
- **Target**: `ws_material_activities`, `ws_material_companions`, `ws_material_conditions`, `ws_material_manufactures`
- **Script**: `workspace/migrate-material/index.ts`

### Disposal Migration
- **Source**: `disposal_stocks`, `disposal_transactions`
- **Target**: `ws_disposal_stocks`, `ws_disposal_transactions`
- **Script**: `workspace/migrate-disposal/index.ts`

## Key Migration Patterns

### Global vs Workspace Tables
- **Global Tables**: Shared across all workspaces (e.g., `locations`, `users`, `entities`)
- **Workspace Tables**: Program-specific data with `ws_` prefix (e.g., `ws_stocks`, `ws_orders`)

### Mapping Tables
- All migrations create mapping tables to track legacy ID to platform ID relationships
- Format: `mapping_{table_name}`
- Contains: `existing_{table}_id`, `platform_{table}_id`, `program_id`

### Database Connections
- **Source Connection**: `getMigrationDB(programId)` - connects to SMILE 3.0 databases
- **Target Connection**: `db` - connects to SMILE 5.0 platform database
- **Sync Connection**: `syncDB` - connects to migration tracking database

## Environment Variables Required

### Source Database (SMILE 3.0)
```bash
# Immunization Database (Program ID 1)
IMUN_DB_NAME=
IMUN_DB_HOST=
IMUN_DB_USER=
IMUN_DB_PORT=
IMUN_DB_PASSWORD=

# Logistics Database (Program ID 2)
LOGISTIK_DB_NAME=
LOGISTIK_DB_HOST=
LOGISTIK_DB_USER=
LOGISTIK_DB_PORT=
LOGISTIK_DB_PASSWORD=
```

### Target Database (SMILE 5.0)
```bash
# Platform Database
PLATFORM_DB_NAME=
PLATFORM_DB_HOST=
PLATFORM_DB_USER=
PLATFORM_DB_PORT=
PLATFORM_DB_PASSWORD=

# Migration Tracking Database
MIGRATION_DB_NAME=
MIGRATION_DB_HOST=
MIGRATION_DB_USER=
MIGRATION_DB_PORT=
MIGRATION_DB_PASSWORD=
```