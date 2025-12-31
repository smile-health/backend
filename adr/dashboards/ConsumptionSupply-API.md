# Consumption Supply API Documentation

## Overview
The Consumption Supply API provides comprehensive functionality for tracking and analyzing consumption and supply data across different time periods, locations, entities, and materials. It supports both overview and detailed reporting with Excel export capabilities.

## Core Functionality
- **Consumption & Supply Tracking**: Monitor consumption and supply quantities over time
- **Multi-dimensional Analysis**: Analyze data by location, entity, material, and time periods
- **Flexible Time Periods**: Support for daily and monthly reporting
- **Excel Export**: Generate downloadable Excel reports with filtering
- **Real-time Data**: Access to last updated timestamps
- **Comparative Analysis**: Above/below threshold comparisons

## API Endpoints

### 1. `/consumption-supply/all`
- **Method**: GET
- **Purpose**: Retrieve overview consumption and supply data across time periods
- **Features**:
  - Time-based aggregation (daily/monthly)
  - Consumption vs supply comparison
  - Position indicators (ABOVE/BELOW)
  - Supports filtering by information type

### 2. `/consumption-supply/all/download`
- **Method**: GET
- **Purpose**: Download Excel report for overview data
- **Features**:
  - Excel template with overview format
  - Filtered data export
  - Localization support (ID/EN)

### 3. `/consumption-supply/location`
- **Method**: GET
- **Purpose**: Retrieve consumption and supply data by location
- **Features**:
  - Location-based breakdown
  - Province and regency information
  - Pagination support
  - Time series data per location

### 4. `/consumption-supply/location/download`
- **Method**: GET
- **Purpose**: Download Excel report for location-based data
- **Features**:
  - Location-specific Excel template
  - Comprehensive filtering

### 5. `/consumption-supply/entity`
- **Method**: GET
- **Purpose**: Retrieve consumption and supply data by entity
- **Features**:
  - Entity-based analysis
  - Entity details with location context
  - Pagination and filtering

### 6. `/consumption-supply/entity/download`
- **Method**: GET
- **Purpose**: Download Excel report for entity-based data

### 7. `/consumption-supply/material`
- **Method**: GET
- **Purpose**: Retrieve consumption and supply data by material
- **Features**:
  - Material-based breakdown
  - Material-specific analysis

### 8. `/consumption-supply/material/download`
- **Method**: GET
- **Purpose**: Download Excel report for material-based data

## Database Tables

### Primary Transaction Tables
- **`datamart_transactions`**: Main transaction data with consumption/supply quantities
- **`dim_orders`**: Order information and transaction context
- **`dim_entity_activity_date`**: Entity activity date relationships

### Dimension Tables
- **`dim_entities`**: Entity master data (hospitals, clinics, etc.)
- **`dim_entity_entity_tags`**: Entity tag relationships
- **`dim_entity_tags`**: Entity tag definitions
- **`dim_provinces`**: Province master data
- **`dim_regencies`**: Regency/city master data
- **`dim_master_materials`**: Material master data
- **`dim_master_material_has_activities`**: Material-activity relationships
- **`dim_batches`**: Batch information
- **`dim_sub_districts`**: Sub-district data

## Query Parameters

### Time Parameters
- **`from`**: Start date (YYYY-MM-DD format)
- **`to`**: End date (YYYY-MM-DD format)
- **`period`**: Time aggregation ('daily' or 'monthly')
- **`currentDate`**: Reference date for calculations

### Location Parameters
- **`provinceId`**: Filter by province ID
- **`regencyId`**: Filter by regency/city ID
- **`subDistrictId`**: Filter by sub-district ID

### Entity Parameters
- **`entityId`**: Filter by specific entity IDs (array)
- **`entityType`**: Filter by entity type (1=hospital, etc.)
- **`entityTags`**: Filter by entity tag IDs (array)

### Material Parameters
- **`masterMaterialId`**: Filter by material IDs (array)
- **`activityId`**: Filter by activity IDs (array)
- **`isVaccine`**: Filter by vaccine status (array: [0,1])

### Report Parameters
- **`informationType`**: Data type ('consumption', 'supply', or both)
- **`page`**: Page number for pagination
- **`limit`**: Records per page

## Response Structure

### Overview Response (`/all`)
```json
{
  "intervalPeriod": ["2024-01", "2024-02"],
  "column": [{"label": "2024 Jan"}, {"label": "2024 Feb"}],
  "subColumn": ["consumption", "supply"],
  "overview": [
    {
      "label": "2024-01",
      "consumption": 1000,
      "supply": 1200,
      "consumptionPosition": "BELOW",
      "supplyPosition": "ABOVE"
    }
  ],
  "last_updated": "2024-01-15T10:30:00Z"
}
```

### Detailed Response (`/location`, `/entity`, `/material`)
```json
{
  "intervalPeriod": ["2024-01", "2024-02"],
  "column": [{"label": "2024 Jan"}, {"label": "2024 Feb"}],
  "subColumn": ["consumption", "supply"],
  "total": 150,
  "page": 1,
  "perPage": 10,
  "list": [
    {
      "id": 1,
      "name": "Entity/Location/Material Name",
      "province": "Province Name",
      "regency": "Regency Name",
      "overview": [
        {
          "label": "2024-01",
          "consumption": 100,
          "supply": 120,
          "consumptionPosition": "BELOW",
          "supplyPosition": "ABOVE"
        }
      ]
    }
  ],
  "last_updated": "2024-01-15T10:30:00Z"
}
```

## Core Functions

### Controller Functions
- **`all(req, res, next)`**: Handle overview consumption/supply data
- **`masterOfProcess({req, res, next, usedFor})`**: Generic processor for location/entity/material endpoints
- **`location(req, res, next)`**: Handle location-based data
- **`entity(req, res, next)`**: Handle entity-based data
- **`material(req, res, next)`**: Handle material-based data

### Helper Functions
- **`generateQueryParam(param)`**: Standardize and validate query parameters
- **`getIntervalPeriod(param)`**: Generate time interval arrays
- **`aboveOrBelow({comparingFor, supply, consumption})`**: Calculate position indicators
- **`periodSwitcher(period)`**: Convert period format
- **`lastUpdated()`**: Get last data update timestamp

## Database Query Functions

### From consumptionSupplyQueries.js
- **`countConsumptionSupply({queryParam, usedFor})`**: Main query for consumption/supply data
- **`getLocationList({queryParam, isDownload, usedForConsumptionSupply})`**: Retrieve location data
- **`getEntityList(param, paginate)`**: Retrieve entity data with pagination
- **`totalEntity(param)`**: Get total entity count
- **`getExportFilterConsumptionSupply(queryParam)`**: Generate export filter data
- **`locationVitalQuery(params)`**: Dynamic location query builder
- **`selectTheId(params, usedFor)`**: Dynamic ID selection

### From rawQueries.js
- **`getMaterialList(param, paginate)`**: Retrieve material data with pagination
- **`totalMaterial(param)`**: Get total material count
- **`getLastUpdated(attribute, table)`**: Get last update timestamp
- **`materialListQuery({param, paginate, forTotal})`**: Core material query function

## Technical Details

### Database Technology
- **ClickHouse**: Primary database for analytics and reporting
- **Real-time Indexing**: Maintains up-to-date data state
- **Optimized Queries**: Uses `final` keyword for ClickHouse optimization

### Query Building
- **Dynamic SQL Construction**: Builds queries based on provided parameters
- **Conditional Filtering**: Applies filters only when parameters are provided
- **Join Optimization**: Efficient joins across dimension tables
- **Parameterized Queries**: Prevents SQL injection with parameter binding

### Performance Considerations
- **Pagination**: Implements limit/offset for large datasets
- **Selective Columns**: Only retrieves necessary columns
- **Index Usage**: Leverages database indexes for filtering
- **Caching**: Potential for query result caching

### Excel Export Features
- **Template-based Generation**: Uses predefined Excel templates
- **Localization**: Supports multiple languages (ID/EN)
- **Streaming**: Efficient memory usage for large exports
- **Custom Formatting**: Applies business-specific formatting
- **Filter Information**: Includes applied filters in export

### Error Handling
- **Try-Catch Blocks**: Comprehensive error catching
- **Next Middleware**: Proper error forwarding
- **Validation**: Parameter validation and sanitization
- **Graceful Degradation**: Handles missing or invalid data

### Data Processing
- **Time Series Aggregation**: Groups data by time periods
- **Comparative Analysis**: Calculates above/below thresholds
- **Multi-dimensional Grouping**: Supports grouping by various dimensions
- **Real-time Calculations**: Performs calculations on-the-fly

## Entity Types
- **Type 1**: Hospital/Healthcare facilities
- **Type 0**: Excluded from certain queries
- **Vendor Entities**: Entities marked as vendors (`is_vendor=1`)
- **Active Entities**: Only active entities (`status = ACTIVE`)

## Constants and Configurations
- **`ENTITY_STATUS.ACTIVE`**: Active entity status constant
- **`ENTITY_TYPE_LABEL`**: Entity type label mappings
- **Date Formats**: Standardized date formatting across the system
- **Timezone**: Uses 'Asia/Jakarta' timezone for date operations