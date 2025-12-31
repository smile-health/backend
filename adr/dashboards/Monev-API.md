# Monev API Documentation

## Overview
The Monev (Monitoring and Evaluation) API provides comprehensive monitoring capabilities for healthcare supply chain management, focusing on stock tracking, distribution monitoring, and receipt status evaluation across different administrative levels (Province, Regency/City, Healthcare Facilities).

### Core Functionalities
- **Stock Monitoring**: Track current stock levels and availability
- **Receipt Tracking**: Monitor items not yet received (in-transit status)
- **Multi-level Analysis**: Support for Province, Regency/City, and Healthcare Facility levels
- **Excel Export**: Generate detailed reports with filtering capabilities
- **Real-time Updates**: Provide last updated timestamps for data freshness

## API Endpoints

| Method | Endpoint | Controller Function | Description |
|--------|----------|-------------------|-------------|
| GET | `/monev/stock` | `stock()` | Retrieve current stock levels and availability data |
| GET | `/monev/not-received` | `notReceived()` | Get items not yet received (in-transit status) |
| GET | `/monev/download` | `download()` | Export comprehensive Excel report with filtering |

## Database Tables

### Primary Data Tables
| Table Name | Purpose | Key Fields |
|------------|---------|------------|
| `datamart_transactions` | Core transaction data for all supply chain activities | `transactions_entity_id`, `transactions_activity_id`, `transactions_master_material_id`, `transactions_createdAt_date`, `entities_entity_tag_id`, `master_materials_is_vaccine` |

### Dimension Tables
| Table Name | Purpose | Key Fields |
|------------|---------|------------|
| `dim_provinces` | Province master data | `id`, `name`, `deleted_at` |
| `dim_regencies` | Regency/City master data | `id`, `name`, `province_id`, `deleted_at` |
| `dim_entities` | Healthcare facilities and entities | `id`, `name`, `code`, `province_id`, `regency_id`, `status`, `is_puskesmas`, `deleted_at` |
| `dim_master_materials` | Material master data | `id`, `name`, `deleted_at` |
| `dim_master_activities` | Activity types | `id`, `name`, `deleted_at` |
| `dim_entity_tags` | Entity classification tags | `id`, `title`, `deleted_at` |
| `dim_entity_entity_tags` | Entity-tag relationships | `entity_id`, `entity_tag_id` |
| `dim_entity_activity_date` | Entity activity date ranges | `entity_id`, `activity_id`, `join_date`, `end_date` |
| `dim_batches` | Batch information | `batches_id`, `batches_code`, `deleted_at` |
| `dim_sub_districts` | Sub-district data | `id`, `name`, `deleted_at` |
| `dim_orders` | Order information | Used in transaction joins |

## Query Parameters

### Common Parameters
| Parameter | Type | Description | Default |
|-----------|------|-------------|----------|
| `to` | Date | End date for data filtering | Current date |
| `page` | Integer | Page number for pagination | 1 |
| `paginate` | Integer | Items per page | 10 |
| `type` | Integer | Entity type (1=Province, 2=City, 3=Faskes) | - |

### Filtering Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| `provinceIds` | Array[Int] | Filter by specific province IDs |
| `regencyIds` | Array[Int] | Filter by specific regency IDs |
| `entityIds` | Array[Int] | Filter by specific entity IDs |
| `activityId` | Array[Int] | Filter by activity types |
| `masterMaterialId` | Array[Int] | Filter by specific materials |
| `entityTags` | Array[Int] | Filter by entity tags |
| `isVaccine` | Array[Int] | Filter by vaccine status (0=Non-vaccine, 1=Vaccine) |
| `batch` | Array[Int] | Filter by batch IDs |
| `startExpiredDate` | Date | Start date for expiration filtering |
| `endExpiredDate` | Date | End date for expiration filtering |

## Response Data Structure

### Stock/Not Received Response
```json
{
  "total": 150,
  "current_page": 1,
  "total_page": 15,
  "summary": 150,
  "list": [
    {
      "row_number": 1,
      "entity": "Entity Name",
      "province": "Province Name",
      "regency": "Regency Name",
      "stock": 100,
      "stock_in_transit": 25,
      "entity_tag": "Tag Name"
    }
  ],
  "last_updated": "2024-01-15 10:30:00"
}
```

### Download Response
- **Content-Type**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Headers**: 
  - `Content-Disposition`: `attachment; filename="filename.xlsx"`
  - `Filename`: Excel file name
  - `Access-Control-Expose-Headers`: `Filename`

## Entity Types
| Type | Value | Description | Additional Columns |
|------|-------|-------------|-------------------|
| Province | 1 | Provincial level analysis | Base columns only |
| City/Regency | 2 | City/Regency level analysis | + Province column |
| Healthcare Facility | 3 | Facility level analysis | + Regency + Entity Tag columns |

## Core Functions

### Main Controller Functions
| Function | Purpose | Parameters |
|----------|---------|------------|
| `stock()` | Get current stock data | `req`, `res`, `next` |
| `notReceived()` | Get not-received items data | `req`, `res`, `next` |
| `download()` | Export Excel report | `req`, `res`, `next` |

### Helper Functions
| Function | Source File | Purpose |
|----------|-------------|----------|
| `calculatingMonev()` | `monevQueries.js` | Core data calculation with complex joins |
| `getLastUpdated()` | `rawQueries.js` | Get last update timestamp |
| `generateQueryParam()` | Internal | Standardize query parameters |
| `processor()` | Internal | Process requests for both stock and not-received |
| `excelFilterColumns()` | Internal | Generate Excel filter metadata |
| `excelMaterialColumns()` | Internal | Generate Excel material filter metadata |

### Dimension Helper Functions
| Function | Source File | Purpose | Tables Queried |
|----------|-------------|---------|----------------|
| `getWholeProvinces()` | `detailDimensionsQueries.js` | Get province details | `dim_provinces` |
| `getWholeRegencies()` | `detailDimensionsQueries.js` | Get regency details | `dim_regencies` |
| `getWholeHospital()` | `detailDimensionsQueries.js` | Get healthcare facility details | `dim_entities` |
| `getMaterialDetail()` | `detailDimensionsQueries.js` | Get material details | `dim_master_materials` |
| `getActivityDetail()` | `detailDimensionsQueries.js` | Get activity details | `dim_master_activities` |
| `getWholeBatches()` | `detailDimensionsQueries.js` | Get batch details | `dim_batches` |
| `getWholeEntityTags()` | `detailDimensionsQueries.js` | Get entity tag details | `dim_entity_tags` |
| `getEntityDetail()` | `detailDimensionsQueries.js` | Get detailed entity info with joins | `dim_entities`, `datamart_transactions`, `dim_entity_activity_date` |

## Technical Details

### Database Technology
- **Database**: ClickHouse
- **Connection**: `officialClient` from `@/database/connection`
- **Query Style**: Parameterized queries with ClickHouse-specific syntax

### Key Features
- **Dynamic Query Building**: Queries are constructed dynamically based on filters
- **Complex Joins**: Multi-table joins across dimension and fact tables
- **Pagination Support**: Built-in pagination for large datasets
- **Excel Export**: Comprehensive Excel generation with multiple sheets
- **Date Filtering**: Flexible date range filtering with default values
- **Entity Hierarchy**: Support for multi-level administrative hierarchy

### Performance Considerations
- Uses `FINAL` modifier for ClickHouse optimization
- Parameterized queries to prevent SQL injection
- Efficient pagination implementation
- Conditional joins based on requirements

### Constants and Enums
- `ENTITY_TYPE`: Province (1), City (2), Faskes (3)
- `ENTITY_STATUS.ACTIVE`: Active entity status filter
- `MONEV_FIELD`: Field mappings for monev calculations

### Error Handling
- Try-catch blocks in all main functions
- Error propagation to Express error handler via `next(err)`
- Graceful handling of missing parameters with defaults

### Excel Export Features
- **Multiple Sheets**: Separate sheets for different data types
- **Dynamic Columns**: Columns adjust based on entity type
- **Filter Summary**: Comprehensive filter information in export
- **Metadata**: Export timestamp and totals included
- **Regional Naming**: Dynamic file naming based on selected regions

## Data Flow
1. **Request Processing**: Parameters validated and standardized
2. **Query Execution**: Dynamic SQL construction and execution
3. **Data Processing**: Results formatted with pagination and metadata
4. **Response**: JSON response or Excel file download
5. **Timestamp**: Last updated information included for data freshness