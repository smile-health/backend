# Excel Export/Import Endpoints Documentation

This document lists all endpoints in the platform that support Excel export/import functionality, as identified from the wire.ts configuration.

## Quick Reference

📄 **Structured Routes**: See [`excel-routes.yml`](./excel-routes.yml) for machine-readable route definitions

## Overview

The following endpoints utilize the `ExcelMiddleware` to provide Excel export and import capabilities:

**Path Structure:**
- **Base Path**: Complete URL path including service prefix (`{BASE_URL}/api/core/...` or `{BASE_URL}/api/main/...`)
- Replace `{BASE_URL}` with your actual API base URL (e.g., `https://api.example.com`)

**Services:**
- **Core Service**: Most endpoints are in the Core service (`/api/core/`)
- **Main Service**: Entity Materials bulk operations are in the Main service (`/api/main/`)
- **Warehouse Service**: Stock monitoring export functionality is in the Warehouse service (`/api/warehouse/`)

## Endpoints with Excel Support

### 1. Entities
- **Base Path**: `{BASE_URL}/api/core/entities`
- **Excel Routes**:
  - `GET /xls` - Export entities to Excel
  - `GET /xls-template` - Download Excel template
  - `POST /xls` - Import entities from Excel
- **Controller**: `EntityController`
- **Middleware**: `ExcelMiddleware`, `EntityMiddleware`, `RoleValidationMiddleware`
- **Description**: Handles entity data export/import operations

### 2. Users
- **Base Path**: `{BASE_URL}/api/core/users`
- **Excel Routes**:
  - `GET /xls` - Export users to Excel
  - `GET /xls-template` - Download Excel template
  - `POST /xls` - Import users from Excel
- **Controller**: `UserController`
- **Middleware**: `ExcelMiddleware`, `UsersMiddleware`, `RoleValidationMiddleware`
- **Description**: Manages user data export/import functionality

### 3. Budget Sources
- **Base Path**: `{BASE_URL}/api/core/budget-sources`
- **Excel Routes**:
  - `GET /xls` - Export budget sources to Excel
- **Controller**: `BudgetSourceController`
- **Middleware**: `ExcelMiddleware`, `BudgetSourceMiddleware`, `RoleValidationMiddleware`
- **Description**: Provides budget source data export capabilities

### 4. Manufactures
- **Base Path**: `{BASE_URL}/api/core/manufactures`
- **Excel Routes**:
  - `GET /xls` - Export manufactures to Excel
  - `GET /xls-template` - Download Excel template
  - `POST /xls` - Import manufactures from Excel
- **Controller**: `ManufactureController`
- **Middleware**: `ExcelMiddleware`, `ManufactureMiddleware`
- **Description**: Handles manufacture data export/import operations

### 5. Materials
- **Base Path**: `{BASE_URL}/api/core/materials`
- **Excel Routes**:
  - `GET /xls` - Export materials to Excel
  - `GET /xls-template` - Download Excel template
  - `POST /xls` - Import materials from Excel
- **Controller**: `MaterialController`
- **Middleware**: `ExcelMiddleware`, `MaterialMiddleware`, `RoleValidationMiddleware`
- **Description**: Manages material data export/import functionality

### 6. Programs
- **Base Path**: `{BASE_URL}/api/core/programs`
- **Excel Routes**:
  - `GET /xls` - Export programs to Excel
  - `GET /xls-template` - Download Excel template
  - `POST /xls` - Import programs from Excel
- **Controller**: `ProgramController`
- **Middleware**: `ExcelMiddleware`, `ProgramMiddleware`
- **Description**: Provides program data export/import capabilities

### 7. Activities
- **Base Path**: `{BASE_URL}/api/core/programs/:program_id/activities`
- **Excel Routes**:
  - `GET /xls` - Export activities to Excel
  - `GET /xls-template` - Download Excel template
  - `POST /xls` - Import activities from Excel
- **Controller**: `ActivityController`
- **Middleware**: `ExcelMiddleware`, `ActivityMiddleware`
- **Description**: Handles activity data export/import operations within specific programs

### 8. Asset Vendors
- **Base Path**: `{BASE_URL}/api/core/asset-vendors`
- **Excel Routes**:
  - `GET /xls` - Export asset vendors to Excel
  - `GET /xls-template` - Download Excel template
  - `POST /xls` - Import asset vendors from Excel
- **Controller**: `AssetVendorController`
- **Middleware**: `ExcelMiddleware`, `AssetVendorMiddleware`
- **Description**: Manages asset vendor data export/import functionality

### 9. Asset Types
- **Base Path**: `{BASE_URL}/api/core/asset-types`
- **Excel Routes**:
  - `GET /xls` - Export asset types to Excel
  - `GET /xls-template` - Download Excel template
  - `POST /xls` - Import asset types from Excel
- **Controller**: `AssetTypeController`
- **Middleware**: `ExcelMiddleware`, `AssetTypeMiddleware`
- **Description**: Provides asset type data export/import capabilities

### 10. Asset Models
- **Base Path**: `{BASE_URL}/api/core/asset-models`
- **Excel Routes**:
  - `GET /xls` - Export asset models to Excel
  - `GET /xls-template` - Download Excel template
  - `POST /xls` - Import asset models from Excel
- **Controller**: `AssetModelController`
- **Middleware**: `ExcelMiddleware`, `AssetModelMiddleware`
- **Description**: Handles asset model data export/import operations

### 11. Entity Materials (Bulk Operations)
- **Base Path**: `{BASE_URL}/api/main/entities-materials-bulk`
- **Excel Routes**:
  - `GET /template` - Download Excel template
  - `POST /xls` - Import entity materials from Excel
  - `GET /` - List import operations
- **Controller**: `EntityMaterialExcelController`
- **Middleware**: `ExcelMiddleware`, `EntityMaterialExcelMiddleware`, `RoleMiddleware`
- **Description**: Handles bulk entity material data import operations with specialized Excel processing
- **Note**: This is a specialized bulk import endpoint in the Main service

### 12. Stock Monitoring (Export Only)
- **Base Path**: `{BASE_URL}/api/warehouse/monitoring/stock`
- **Export Routes**:
  - `GET /export` - Export stock monitoring data to CSV
- **Controller**: `MonitoringStockController`
- **Middleware**: `ExcelMiddleware`, `MonitoringStockMiddleware`, `RoleMiddleware`
- **Description**: Provides stock monitoring data export functionality
- **Note**: Exports CSV format, not Excel format; uses ExcelMiddleware but with custom CSV export logic

## Additional Related Endpoints

### Export History
- **Full Path**: `{BASE_URL}/api/core/export-histories`
- **Route Path**: `/export-histories`
- **Controller**: `ExportHistoryController`
- **Description**: Tracks and manages export operation history (no ExcelMiddleware but related to export functionality)

## Notes

- 11 endpoints provide standard Excel functionality (export/import with .xlsx format) using the `ExcelMiddleware` from `@smile/lib/middlewares`
- 1 additional endpoint (Stock Monitoring) uses `ExcelMiddleware` but exports CSV format instead of Excel
- Most endpoints also include `RoleValidationMiddleware` or `RoleMiddleware` for access control
- The `ExportHistoryController` is related to export operations but doesn't directly use ExcelMiddleware
- Each controller has its own specific middleware for business logic validation
- Entity Materials bulk operations are handled separately in the Main service with specialized processing
- Stock Monitoring in the Warehouse service provides CSV export functionality using ExcelMiddleware infrastructure

## Implementation Details

The Excel functionality is implemented through:
- **ExcelMiddleware**: Handles Excel file processing
- **Individual Controllers**: Implement specific export/import logic for each domain
- **Role Validation**: Ensures proper access control for export/import operations
- **Export History**: Tracks export operations for auditing purposes