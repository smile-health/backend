# Count Transaction API Documentation

## Overview

The Count Transaction API provides comprehensive transaction counting and reporting functionality for the warehouse management system. It offers various endpoints to retrieve transaction data aggregated by different dimensions (overview, material, entity, location) with support for Excel export functionality.

## API Endpoints

### Base URL
```
/dashboard/count-transaction
```

### Authentication & Authorization
All endpoints require:
- Authentication: `isAuthenticate` middleware
- Role-based access: `dashboardRoleAccess` with roles:
  - `MANAGER` (3)
  - `ADMIN` (2) 
  - `SUPERADMIN` (1)
  - `SATUSEHAT` (13)

### Endpoints

#### 1. Count Transaction Overview
```http
GET /dashboard/count-transaction/all
```
**Description:** Retrieves transaction count overview data grouped by time periods.

**Features:**
- Redis caching enabled (`cacheMiddleware`)
- Groups transactions by period (day, week, month, year)
- Calculates total transaction counts and percentages
- Returns data for chart visualization

**Controller Function:** `countTransactionOveriew`

#### 2. Count Transaction Overview Download
```http
GET /dashboard/count-transaction/all/download
```
**Description:** Downloads Excel report for transaction overview data.

**Features:**
- Generates Excel file using `excelTemplateCountTransaction`
- Includes filter information and period-based data
- Returns file download response

**Controller Function:** `countTransactionOveriewDownload`

#### 3. Count Transaction by Material
```http
GET /dashboard/count-transaction/material
```
**Description:** Retrieves transaction counts grouped by material.

**Features:**
- Redis caching enabled
- Groups data by material ID
- Supports transaction type filtering
- Returns material-specific transaction statistics

**Controller Function:** `countTransactionMaterial`

#### 4. Count Transaction Material Download
```http
GET /dashboard/count-transaction/material/download
```
**Description:** Downloads Excel report for material-based transaction data.

**Controller Function:** `countTransactionDownload`

#### 5. Count Transaction by Entity
```http
GET /dashboard/count-transaction/entity
```
**Description:** Retrieves transaction counts grouped by entity.

**Features:**
- Redis caching enabled
- Groups data by entity ID
- Includes entity hierarchy (province, regency)
- Returns entity-specific transaction statistics

**Controller Function:** `countTransactionEntity`

#### 6. Count Transaction Entity Download
```http
GET /dashboard/count-transaction/entity/download
```
**Description:** Downloads Excel report for entity-based transaction data.

**Controller Function:** `countTransactionDownload`

#### 7. Count Transaction by Location
```http
GET /dashboard/count-transaction/location
```
**Description:** Retrieves transaction counts grouped by location (province/regency).

**Features:**
- Redis caching enabled
- Groups data by location ID
- Supports province and regency level aggregation
- Returns location-specific transaction statistics

**Controller Function:** `countTransactionLocation`

#### 8. Count Transaction Location Download
```http
GET /dashboard/count-transaction/location/download
```
**Description:** Downloads Excel report for location-based transaction data.

**Controller Function:** `countTransactionDownload`

## Database Schema

### Primary Tables

#### 1. datamart_transactions
**Description:** Main transaction data table

**Key Columns:**
- `transactions_createdAt`: Transaction creation timestamp
- `master_materials_id`: Material identifier
- `entities_id`: Entity identifier
- `transactions_activity_id`: Activity identifier
- `period`: Time period grouping
- `location_id`: Location identifier
- `change_qty`: Quantity change
- `frequency`: Transaction frequency count

#### 2. dim_entity_activity_date
**Description:** Entity activity date mapping

**Key Columns:**
- `entity_id`: Entity identifier
- `activity_id`: Activity identifier
- `join_date`: Entity join date
- `end_date`: Entity end date

#### 3. Supporting Dimension Tables
- `dim_provinces`: Province master data
- `dim_regencies`: Regency master data
- `dim_entities`: Entity master data
- `dim_master_materials`: Material master data
- `dim_master_activities`: Activity master data
- `dim_entity_tags`: Entity tag classifications
- `dim_entity_entity_tags`: Entity-tag relationships
- `dim_transaction_reasons`: Transaction reason codes

## Query Parameters

### Common Parameters
- `isVaccine`: Filter by vaccine/non-vaccine materials (boolean)
- `activityId`: Filter by specific activity ID
- `entityId`: Filter by specific entity ID
- `entityTags`: Filter by entity tag IDs (array)
- `entityType`: Filter by entity type
- `masterMaterialId`: Filter by material ID
- `provinceId`: Filter by province ID
- `regencyId`: Filter by regency ID
- `transactionType`: Filter by transaction type ID
- `period`: Time period grouping (day, week, month, year)
- `from`: Start date (YYYY-MM-DD)
- `to`: End date (YYYY-MM-DD)
- `page`: Pagination page number
- `limit`: Pagination limit
- `currentDate`: Current date for calculations

## Helper Functions

### Core Helper Functions

#### 1. `getCountTransactionParam(req)`
**File:** `transaction.js`
**Purpose:** Parses and standardizes request parameters

**Features:**
- Parameter validation and type conversion
- User role-based filtering for province/regency
- Date range validation
- Default value assignment

#### 2. `getSrcCountTransactionData(queryParam)`
**File:** `countTransactionQueries.js`
**Purpose:** Executes main transaction data query

**Features:**
- Dynamic WHERE clause construction
- Date range filtering on `transactions_createdAt`
- Entity activity date filtering via subquery
- Groups by material, entity, activity, period, and location

#### 3. `geTotalCountTransaction(data, informationType)`
**File:** `transaction.js`
**Purpose:** Calculates total transaction count or quantity

**Parameters:**
- `data`: Transaction data array
- `informationType`: 'frequency' or 'quantity'

#### 4. `getCountTransactionValue(data, column, informationType)`
**File:** `transaction.js`
**Purpose:** Sums values from transaction data

**Parameters:**
- `data`: Transaction data array
- `column`: Column to sum
- `informationType`: 'frequency' or 'quantity'

#### 5. `getTransactionTypeSeries(transactionType)`
**File:** `transaction.js`
**Purpose:** Provides transaction type metadata

**Returns:** Array of transaction types with:
- `id`: Transaction type ID
- `label`: Display label
- `column`: Database column name
- `color`: Chart color

### Excel Export Functions

#### 1. `excelTemplateCountTransaction(options)`
**File:** `excel.js`
**Purpose:** Generates Excel reports for count transaction data

**Features:**
- Dynamic column generation based on transaction types
- Multi-language support (Indonesian/English)
- Period-based data organization
- Entity hierarchy support (province, regency, entity)
- Custom styling and formatting

#### 2. `createWorkbook(options)`
**File:** `excel.js`
**Purpose:** Creates Excel workbook with headers and formatting

**Features:**
- Title and filter information
- Dynamic column headers
- Cell merging for period grouping
- Styling and alignment

## Transaction Types

### Supported Transaction Types
```javascript
TRANSACTION_TYPE = {
  STOCK_COUNT: 1,     // Hitung Stok
  ISSUES: 2,          // Pengeluaran
  RECEIPTS: 3,        // Penerimaan
  DISCARDS: 4,        // Pembuangan
  RETURN: 5,          // Pengembalian
  OPENED_RECEIVES: 6, // Penerimaan Buka
  STOCK_ADD: 7,       // Tambah Stok
  STOCK_REMOVE: 8,    // Kurangi Stok
  CANCEL_DISCARD: 11  // Batal Pembuangan
}
```

### Transaction Type Series Configuration
Each transaction type includes:
- **Label:** Human-readable name
- **Column:** Database column for quantity/count
- **Color:** Visualization color code

## Entity Types

```javascript
ENTITY_TYPE = {
  PROVINCE: 1,           // Dinkes Provinsi
  CITY: 2,              // Dinkes Kabupaten/Kota
  FASKES: 3,            // Faskes
  VACCINE_CENTER: 4,    // Pusat Vaksin
  INSTALASI_FARMASI: 95, // Instalasi Farmasi
  KEMENKES_RI: 97,      // Kemenkes RI
  GUDANG_VAKSIN: 98     // Gudang Vaksin
}
```

## Export Types

```javascript
EXPORT_TYPE = {
  COUNT_TRANSACTION: 'Hitung Transaksi'
}

EXPORT_DETAIL = {
  OVERVIEW: 'Keseluruhan',
  MATERIAL: 'Material',
  ENTITY: 'Entitas',
  LOCATION: 'Lokasi'
}
```

## Data Flow

### 1. Request Processing
1. Authentication and authorization check
2. Parameter parsing via `getCountTransactionParam()`
3. Cache check (for cached endpoints)
4. Query execution via `getSrcCountTransactionData()`

### 2. Data Processing
1. Raw data retrieval from ClickHouse
2. Data grouping by specified dimension
3. Calculation of totals and percentages
4. Series data generation for charts

### 3. Response Generation
1. JSON response for API endpoints
2. Excel file generation for download endpoints
3. Cache storage (for cached endpoints)

## Performance Considerations

### Caching Strategy
- Redis caching enabled for data retrieval endpoints
- Cache key based on request parameters
- Improves response time for frequently accessed data

### Database Optimization
- Uses ClickHouse for analytical queries
- Optimized date range filtering
- Efficient grouping and aggregation
- Subquery optimization for entity activity dates

### Query Optimization
- Dynamic WHERE clause construction
- Indexed columns for filtering
- Efficient JOIN operations
- Pagination support for large datasets

## Error Handling

### Common Error Scenarios
1. **Invalid Parameters:** Parameter validation in helper functions
2. **Database Errors:** Connection and query execution errors
3. **Authorization Errors:** Role-based access control
4. **Cache Errors:** Redis connection issues

### Error Response Format
```javascript
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}
```

## Usage Examples

### 1. Get Transaction Overview
```http
GET /dashboard/count-transaction/all?from=2024-01-01&to=2024-01-31&period=day&activityId=1
```

### 2. Get Material-based Transactions
```http
GET /dashboard/count-transaction/material?provinceId=11&isVaccine=true&transactionType=3
```

### 3. Download Entity Report
```http
GET /dashboard/count-transaction/entity/download?entityType=3&from=2024-01-01&to=2024-01-31
```

## Dependencies

### External Libraries
- **Express.js:** Web framework
- **Lodash:** Utility functions
- **ExcelJS:** Excel file generation
- **Moment.js:** Date manipulation
- **Redis:** Caching

### Internal Dependencies
- **Database Connection:** ClickHouse client
- **Authentication Middleware:** User authentication
- **Role Middleware:** Authorization
- **Cache Middleware:** Redis caching

## File Structure

```
warehouse-api/
├── app/
│   ├── controllers/
│   │   └── countTransactionController.js    # Main controller
│   ├── routes/
│   │   └── dashboard/
│   │       ├── index.js                     # Dashboard router
│   │       └── countTransaction.js          # Count transaction routes
│   └── helpers/
│       ├── constants.js                     # Application constants
│       ├── transaction.js                   # Transaction helper functions
│       └── partial-queries/
│           ├── countTransactionQueries.js   # Database queries
│           └── excel.js                     # Excel generation
```

## Maintenance Notes

### Regular Maintenance Tasks
1. **Cache Management:** Monitor Redis memory usage
2. **Query Performance:** Review slow query logs
3. **Data Validation:** Verify data integrity
4. **Error Monitoring:** Track error rates and patterns

### Future Enhancements
1. **Real-time Updates:** WebSocket support for live data
2. **Advanced Filtering:** Additional filter options
3. **Custom Reports:** User-defined report templates
4. **API Versioning:** Support for multiple API versions

---

*Last Updated: January 2025*
*Version: 1.0*