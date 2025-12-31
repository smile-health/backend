# Abnormal Stock API Documentation

## Overview

The Abnormal Stock API provides comprehensive analytics and reporting capabilities for tracking stock availability anomalies across the healthcare supply chain. This API enables monitoring of stock conditions that deviate from normal availability patterns, helping identify potential supply chain issues and optimize inventory management.

## Core Functionalities

### 1. Stock Availability Analysis
- **Multi-dimensional Analysis**: Track abnormal stock patterns by material, entity, location, and time periods
- **Threshold-based Detection**: Identify stock levels below minimum thresholds or above maximum limits
- **Trend Analysis**: Monitor stock availability trends over configurable time periods (daily, weekly, monthly, quarterly)
- **Comparative Analytics**: Compare current stock levels against historical averages and expected ranges

### 2. Data Export and Reporting
- **Excel Export**: Generate detailed reports in Excel format with customizable templates
- **Filtered Downloads**: Export specific data subsets based on location, material, entity, or time range filters
- **Overview Reports**: Summary-level reports for executive dashboards and high-level monitoring

### 3. Real-time Monitoring
- **Last Updated Tracking**: Monitor data freshness with automatic timestamp tracking
- **Dynamic Filtering**: Real-time filtering capabilities across multiple dimensions
- **Pagination Support**: Efficient data retrieval for large datasets

## API Endpoints

### Overview Endpoints
- `GET /abnormal-stock/overview` - Retrieve abnormal stock overview data
- `GET /abnormal-stock/overview/download` - Download overview data in Excel format

### Material-based Analysis
- `GET /abnormal-stock/material` - Get abnormal stock data grouped by material
- `GET /abnormal-stock/material/download` - Download material-based abnormal stock data

### Entity-based Analysis
- `GET /abnormal-stock/entity` - Get abnormal stock data grouped by entity
- `GET /abnormal-stock/entity/download` - Download entity-based abnormal stock data

### Location-based Analysis
- `GET /abnormal-stock/location` - Get abnormal stock data grouped by location (province/regency)

### Export and Download
- `GET /abnormal-stock/download` - Download detailed abnormal stock data with filters
- `GET /abnormal-stock/export-filter` - Get available export filter options

## Database Tables and Schema

### Primary Transaction Tables
- **datamart_transactions (dt)**: Core transaction data with stock movements and changes
- **dim_orders (do)**: Order information linked to transactions
- **dim_batches (db)**: Batch tracking for expiration and quality control

### Dimension Tables

#### Material Dimensions
- **dim_master_materials (dmm)**: Master material catalog with specifications
- **dim_master_material_has_activities (dmmha)**: Material-activity relationships
- **dim_mapping_master_materials (dmmm)**: Material mapping and categorization
- **dim_entity_master_material_activities (demma)**: Entity-material-activity associations with min/max thresholds

#### Entity and Location Dimensions
- **dim_entities (de)**: Healthcare entities (hospitals, clinics, warehouses)
- **dim_entity_has_master_material (dehmm)**: Entity-material relationships
- **dim_entity_activity_date (dead)**: Entity activity periods and operational dates
- **dim_provinces (dp)**: Provincial administrative boundaries
- **dim_regencies (dr)**: Regency/city administrative boundaries
- **dim_entity_tags (det)**: Entity classification tags
- **dim_entity_entity_tags (deet)**: Entity-tag associations

#### Activity and Operational Dimensions
- **dim_master_activities (dma)**: Master activity definitions
- **dim_entity_master_material_activities (demma)**: Complex relationships between entities, materials, and activities

### Database Connections
- **Primary Database**: Uses `officialClientJson` for main data warehouse queries
- **Logistic Database**: Uses `officialLogisticClientJson` for logistics-specific data
- **Source Determination**: Automatically selects appropriate database based on URL path (logistic vs immunization)

## Query Parameters

### Time and Period Filters
- `period`: Time period for analysis (daily, weekly, monthly, quarterly)
- `from`: Start date for data range
- `to`: End date for data range

### Location Filters
- `provinceId`: Filter by specific province(s)
- `regencyId`: Filter by specific regency/city
- `subDistrictId`: Filter by sub-district

### Material and Entity Filters
- `masterMaterialId`: Filter by specific material(s)
- `entityId`: Filter by specific entity/entities
- `entityType`: Filter by entity type
- `entityTags`: Filter by entity classification tags
- `activityId`: Filter by specific activities

### Analysis Parameters
- `informationType`: Type of information to retrieve
- `transactionType`: Specific transaction types to analyze
- `kfa_level`: KFA (Key Performance Area) level for analysis

### Pagination and Output
- `page`: Page number for paginated results
- `limit`: Number of records per page

## Response Data Structure

### Overview Response
```json
{
  "intervalPeriod": ["2024-01", "2024-02", "2024-03"],
  "overview": [
    {
      "label": "2024-01",
      "value": {
        "availability": 85.5,
        "count": 150,
        "total_entities": 200
      }
    }
  ],
  "column": ["availability"],
  "subColumn": ["value"],
  "last_updated": "2024-01-15T10:30:00Z"
}
```

### Material/Entity Response
```json
{
  "intervalPeriod": ["2024-01", "2024-02"],
  "column": ["availability"],
  "list": [
    {
      "id": 123,
      "name": "Vaccine A",
      "overview": [
        {
          "label": "2024-01",
          "value": {
            "availability": 75.2,
            "count": 45
          }
        }
      ]
    }
  ],
  "subColumn": ["value"],
  "page": 1,
  "perPage": 20,
  "total": 150,
  "last_updated": "2024-01-15T10:30:00Z"
}
```

## Key Features

### Stock Availability Calculation
- **Threshold Analysis**: Compares current stock levels against predefined minimum and maximum thresholds
- **Percentage Calculation**: Calculates availability percentages based on stock-to-threshold ratios
- **Duration Tracking**: Monitors how long stock levels remain in abnormal states
- **Frequency Analysis**: Tracks frequency of abnormal stock occurrences

### Multi-Database Support
- **Immunization Program**: Uses immunization-specific database tables
- **Logistics Program**: Uses logistics-specific database tables with `LOGISTIC_` prefixed constants
- **Automatic Routing**: Determines database based on request URL path

### Advanced Filtering
- **User Role-based Filtering**: Automatically applies location filters based on user permissions
- **Dynamic Query Building**: Constructs complex queries based on multiple filter combinations
- **Efficient Pagination**: Optimized pagination for large datasets

### Excel Export Features
- **Template-based Generation**: Uses predefined Excel templates for consistent formatting
- **Multi-sheet Reports**: Generates reports with multiple data sheets
- **Custom Styling**: Applies organization-specific styling and branding
- **Data Validation**: Includes data validation and formatting rules

## Technical Implementation

### Helper Functions
- **stockAvailabilityQueries.js**: Core query building and execution
- **listDimensionsQueries.js**: Dimension data retrieval (legacy)
- **listDimensionsV2Queries.js**: Enhanced dimension data retrieval
- **rawQueries.js**: Raw SQL query execution and data processing
- **stockAvailability.js**: Stock calculation and analysis logic
- **excel.js**: Excel template generation and formatting

### Data Processing
- **Grouping and Aggregation**: Groups data by multiple dimensions (time, location, material, entity)
- **Statistical Calculations**: Performs statistical analysis on stock availability metrics
- **Data Transformation**: Transforms raw transaction data into meaningful analytics
- **Caching Strategy**: Implements efficient caching for frequently accessed dimension data

### Performance Optimizations
- **Indexed Queries**: Utilizes database indexes for optimal query performance
- **Batch Processing**: Processes large datasets in manageable batches
- **Memory Management**: Efficient memory usage for large data exports
- **Connection Pooling**: Manages database connections efficiently

## Security and Access Control
- **Role-based Access**: Restricts data access based on user roles (ADMIN, SUPERADMIN, regular users)
- **Location-based Filtering**: Automatically filters data based on user's assigned location
- **Data Sanitization**: Validates and sanitizes all input parameters
- **Error Handling**: Comprehensive error handling with appropriate HTTP status codes

## Monitoring and Maintenance
- **Last Updated Tracking**: Monitors data freshness across all endpoints
- **Error Logging**: Comprehensive error logging for debugging and monitoring
- **Performance Metrics**: Tracks query performance and response times
- **Data Quality Checks**: Validates data integrity and consistency

This API serves as a critical component of the healthcare supply chain management system, providing essential insights into stock availability patterns and helping prevent stockouts and overstock situations.