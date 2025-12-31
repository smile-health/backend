# Dashboard Routine API Documentation

This document provides comprehensive documentation for the Dashboard Routine API endpoints and their underlying database structure.

## Overview

The Dashboard Routine API provides three main functionalities:

1. **Inventory Management** - Track stock levels and statuses
2. **Asset Monitoring** - Monitor temperature and status of assets
3. **Activity Tracking** - Monitor entity activity and transaction patterns

## API Endpoints

| Endpoint              | Method | Controller Function | Description                                                |
| --------------------- | ------ | ------------------- | ---------------------------------------------------------- |
| `/inventory/overview` | GET    | `inventoryOverview` | Get inventory status overview with pie chart data          |
| `/inventory/location` | GET    | `inventoryLocation` | Get inventory status by location (province/regency/entity) |
| `/asset/overview`     | GET    | `assetOverview`     | Get asset status overview with pie chart data              |
| `/asset/location`     | GET    | `assetLocation`     | Get asset status by location                               |
| `/activity/overview`  | GET    | `activityOverview`  | Get entity activity overview (active/inactive)             |
| `/activity/location`  | GET    | `activityLocation`  | Get entity activity by location                            |

## Database Tables

### Primary Data Tables

| Table Name                 | Alias           | Purpose                                       | Key Fields                                                                                                   |
| -------------------------- | --------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `datamart_rutin_inventory` | dri, dri1, dri2 | Stores routine inventory data                 | `transactions_createdAt_as_date`, `entities_id`, `master_materials_id`, `transactions_activity_id`, `status` |
| `datamart_suhu_asset`      | dsa             | Stores asset temperature and status           | `assets_parent_id`, `assets_temp`, `temp_status`, `entities_province_id`, `logger_histories_updated_at`      |
| `datamart_transactions`    | dt              | Stores transaction data for activity tracking | `entities_id`, `transactions_createdAt`, `transactions_transaction_type_id`, `entities_status`               |

### Dimension Tables

| Table Name                 | Alias | Purpose                            | Key Fields                                                               |
| -------------------------- | ----- | ---------------------------------- | ------------------------------------------------------------------------ |
| `dim_entities`             | de    | Entity master data                 | `id`, `name`, `type`, `province_id`, `regency_id`, `is_vendor`, `status` |
| `dim_entity_activity_date` | dead  | Entity activity date relationships | `entity_id`, `activity_id`, `join_date`, `end_date`                      |
| `dim_entity_entity_tags`   | deet  | Entity tags junction table         | `entity_id`, `entity_tag_id`                                             |

## Query Parameters

### Common Parameters

| Parameter          | Type    | Description                           | Example      |
| ------------------ | ------- | ------------------------------------- | ------------ |
| `from`             | Date    | Start date filter                     | `2024-01-01` |
| `to`               | Date    | End date filter                       | `2024-12-31` |
| `province`         | String  | Province IDs (comma-separated)        | `1,2,3`      |
| `regency`          | String  | Regency IDs (comma-separated)         | `101,102`    |
| `material`         | String  | Material IDs (comma-separated)        | `1,2,3`      |
| `masterMaterialId` | String  | Master Material IDs (comma-separated) | `10,20,30`   |
| `vendorTag`        | String  | Vendor tag IDs (comma-separated)      | `1,2`        |
| `isVaccine`        | String  | Vaccine filter (comma-separated)      | `0,1`        |
| `activityId`       | String  | Activity IDs (comma-separated)        | `1,2,3`      |
| `active`           | Boolean | Filter for active entities            | `true`       |
| `asset`            | Boolean | Asset-specific filtering              | `true`       |

## Response Data Structures

### Inventory Overview Response

```json
{
  "current_time": "DD/MM/YYYY h:mm",
  "last_updated": "timestamp",
  "group_by": "entities",
  "province_name": "string",
  "regency_name": "string",
  "map_name": "string",
  "pie": {
    "inventories": [
      {
        "label": "Normal|< Min|> Max|Habis",
        "color": "#hex_color",
        "value": "number",
        "percent": "percentage",
        "toolText": "description"
      }
    ]
  }
}
```

### Asset Overview Response

```json
{
  "current_time": "DD/MM/YYYY h:mm",
  "last_updated": "timestamp",
  "group_by": "entities",
  "province_name": "string",
  "regency_name": "string",
  "map_name": "string",
  "pie": {
    "asset": [
      {
        "label": "Normal|Low|High|unknown",
        "color": "#hex_color",
        "value": "number",
        "percent": "percentage",
        "toolText": "description"
      }
    ]
  }
}
```

### Activity Overview Response

```json
[
  {
    "last_updated": "timestamp",
    "yAxisName": "Activity",
    "categories": [
      {
        "category": [{ "label": "" }]
      }
    ],
    "dataset": [
      {
        "seriesname": "Active|Inactive",
        "data": [
          {
            "value": "number",
            "toolText": "description",
            "color": "#hex_color"
          }
        ]
      }
    ]
  }
]
```

## Status Classifications

### Inventory Status

| Status | Color   | Description                   |
| ------ | ------- | ----------------------------- |
| Normal | #00B050 | Stock within normal range     |
| < Min  | #FFC002 | Stock below minimum threshold |
| > Max  | #00B0F0 | Stock above maximum threshold |
| Habis  | #ED1B23 | Out of stock                  |

### Asset Status

| Status  | Color   | Description                     |
| ------- | ------- | ------------------------------- |
| normal  | #00B050 | Asset operating normally        |
| < min   | #1BA8DF | Asset temperature below minimum |
| > max   | #EE1D23 | Asset temperature above maximum |
| unknown | #7F7F7F | Asset status unknown            |

### Activity Status

| Status   | Color   | Description                       |
| -------- | ------- | --------------------------------- |
| Active   | #00b050 | Entity has recent transactions    |
| Inactive | #ed1b23 | Entity has no recent transactions |

## Database Technology

The system uses **ClickHouse** database, evidenced by:

- Use of `final` keyword in queries
- Array functions like `arrayExists`
- Specific ClickHouse SQL syntax patterns

## Key Functions

### Core Functions

| Function                | Purpose                                     | Returns                    |
| ----------------------- | ------------------------------------------- | -------------------------- |
| `getValidatedFilter()`  | Validates and processes query parameters    | Validated filter object    |
| `getInventory()`        | Retrieves inventory data with filters       | Array of inventory records |
| `getAssetStatus()`      | Retrieves asset status data                 | Array of asset records     |
| `getActiveEntities()`   | Gets entities with recent activity          | Array of active entities   |
| `getInActiveEntities()` | Gets entities without recent activity       | Array of inactive entities |
| `dateValidation()`      | Validates and formats date parameters       | Formatted date object      |
| `colorSchema()`         | Determines color scheme based on percentage | Color configuration object |

### Helper Functions

The controller uses external helper functions from `../helpers/partial-queries/listDimensionsQueries`:

- `getEntityList()` - Retrieves entity dimension data
- `getMasterMaterialList()` - Retrieves material dimension data
- `getProvinceList()` - Retrieves province dimension data
- `getRegencyList()` - Retrieves regency dimension data

## Location Hierarchy

The system supports a three-level location hierarchy:

1. **Province Level** - Top-level administrative division
2. **Regency Level** - Second-level administrative division
3. **Entity Level** - Individual facilities/locations

Location data is filtered and displayed based on user permissions and selected hierarchy level.

## Performance Considerations

- Queries use date range filtering to limit data scope
- Entity activity date joins ensure only active relationships are considered
- Aggregation is performed at the database level for better performance
- Results are grouped and sorted for optimal frontend rendering

## Error Handling

All endpoints implement consistent error handling:

- Input validation for date ranges and parameters
- Database connection error handling
- Standardized error response format using `errorResponse()` helper
- HTTP 500 status codes for server errors