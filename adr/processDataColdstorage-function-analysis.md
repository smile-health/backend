# ADR: processDataColdstorage Function Analysis

## Status
Documented

## Context
This document provides a comprehensive analysis of the `processDataColdstorage` function located in `/apps/3.0/main-api/app/controllers/coldstorageController.js` at line 483. This function is a critical component of the cold storage management system that calculates storage capacity, volume utilization, and material projections for vaccine storage facilities.

## Function Overview

### Function Signature
```javascript
async function processDataColdstorage(entity_id, master_material_id, t)
```

### Parameters
- **entity_id** (Integer): The unique identifier of the healthcare entity/facility
- **master_material_id** (Integer, Optional): Specific material ID to process. If null, processes all materials for the entity
- **t** (Transaction): Database transaction object for ensuring data consistency

## Business Logic Analysis

### 1. Core Purpose
The function manages cold storage capacity calculations for vaccine storage facilities, tracking both current and projected storage utilization across different temperature ranges.

### 2. Main Data Flow

#### Phase 1: Data Initialization
1. **Temperature Range Setup**: Retrieves all temperature ranges from `RangeTemperature` table
2. **Cold Storage Retrieval**: Finds or creates cold storage record for the entity
3. **Asset Collection**: Gathers all cold storage assets (refrigerators, freezers) for the entity
4. **Variable Initialization**: Sets up calculation variables for current and projected values

#### Phase 2: Asset Volume Calculation
```javascript
// Formula: Total Asset Volume
for (let asset of Assets) {
  const { asset_model, other_capacity_nett } = asset
  let capacity = (asset_model ? asset_model?.capacity_nett : other_capacity_nett) || 0
  volume_asset += capacity
}
```

#### Phase 3: Material Processing
The function handles two scenarios:

**Scenario A: New Cold Storage Creation**
- Creates new cold storage record
- Calls `createColdstorageMaterials()` to initialize all vaccine materials

**Scenario B: Existing Cold Storage Update**
- Updates specific material if `master_material_id` provided
- Recalculates all material-related metrics

### 3. Key Calculations and Formulas

#### A. Stock Calculations
```javascript
// Dosage Stock: Sum of all stock quantities
coldStorageMaterial.dosage_stock += stock.qty

// Vial Stock: Convert dosage to vials
if (box_vial) {
  coldStorageMaterial.vial_stock += Number((stock.qty / box_vial).toFixed(2))
}

// Package Stock: Convert vials to packages
if (box_vial && box_volume) {
  coldStorageMaterial.package_stock += Number(((stock.qty / box_vial) / box_volume))
}
```

#### B. Volume Calculations
```javascript
// Volume per box (in liters)
volume_box = ((box_length * box_width * box_height) / 1000)

// Package Volume: Total volume occupied by packages
coldStorageMaterial.package_volume += Number((volume_box * ((stock.qty / box_vial) / box_volume)).toFixed(2))
```

#### C. Projection Calculations
```javascript
// Maximum dosage requirement
for (const item of entityMasterMaterialActivities) {
  coldStorageMaterial.max_dosage += item.max
}

// Recommended order quantity
coldStorageMaterial.recommend_order_base_on_max = 
  coldStorageMaterial.max_dosage > entityMaterial.on_hand_stock ? 
  coldStorageMaterial.max_dosage - entityMaterial.on_hand_stock : 0

// Projected stock
coldStorageMaterial.projection_stock = 
  coldStorageMaterial.recommend_order_base_on_max + coldStorageMaterial.dosage_stock
```

#### D. Capacity Utilization
```javascript
// Current capacity percentage
coldStorage.percentage_capacity = coldStorage.volume_asset ? 
  (coldStorage.total_volume / coldStorage.volume_asset * 100) : 0

// Projected capacity percentage
coldStorage.projection_percentage_capacity = coldStorage.projection_volume_asset ? 
  (coldStorage.projection_total_volume / coldStorage.projection_volume_asset * 100) : 0
```

#### E. Temperature-Based Calculations
```javascript
// Capacity per temperature range
const percentageCapacity = item.volume_asset ? 
  (item.total_volume / item.volume_asset * 100) : 0

const projectionPercentageCapacity = item.projection_volume_asset ? 
  (item.projection_total_volume / item.projection_volume_asset * 100) : 0
```

#### F. Remaining Package Fulfillment
```javascript
// Calculate remaining space for packages
let remain_package_fulfill = 0
if (item.volume_per_liter) {
  remain_package_fulfill = Math.floor((coldStorage.volume_asset - coldStorage.total_volume) / (item.volume_per_liter))
} else if (item.package_stock && item.package_volume) {
  remain_package_fulfill = Math.floor((coldStorage.volume_asset - coldStorage.total_volume) / (item.package_volume / item.package_stock))
}
```

### 4. Database Models Involved

#### Primary Models:
- **Coldstorage**: Main cold storage facility record
- **ColdstorageMaterial**: Material-specific storage data
- **ColdstoragePerTemperature**: Temperature range-specific storage data
- **AssetIot**: Physical storage assets (refrigerators, freezers)
- **RangeTemperature**: Temperature range definitions

#### Supporting Models:
- **EntityMasterMaterial**: Entity-material relationships
- **MasterVolumeMaterialManufacture**: Material volume specifications
- **ColdstorageTransactionLog**: Transaction logging

### 5. Business Rules

#### Capacity Monitoring
- **Alert Threshold**: 80% capacity triggers notification
- **Notification Logic**: Only triggers when crossing from below 80% to above 80%

#### Material Filtering
- **Vaccine Only**: Only processes materials where `is_vaccine = 1`
- **Active Assets**: Only includes assets with `status = 1`

#### Temperature Mapping
- Assets are mapped to temperature ranges based on `min_temp` and `max_temp`
- Materials are associated with specific temperature ranges

### 6. Data Precision
- Volume calculations rounded to 2 decimal places
- Package stock always rounded up using `Math.ceil()`
- Percentage calculations rounded to 2 decimal places

### 7. Transaction Management
- All database operations wrapped in transaction `t`
- Ensures data consistency across multiple table updates
- Rollback capability in case of errors

## Technical Considerations

### Performance Optimizations
- Bulk operations for temperature-based data using `Promise.all()`
- Efficient querying with proper includes and conditions
- Transaction-based operations for data integrity

### Error Handling
- Graceful handling of missing volume data
- Default values for undefined calculations
- Safe division operations with zero checks

### Scalability Concerns
- Function processes all materials for an entity when `master_material_id` is null
- Multiple database queries within loops could impact performance with large datasets
- Consider batch processing for entities with many materials

## Database Columns and Data Processing Table

The following table shows all database columns involved in the `processDataColdstorage` function, their sources, and how they are processed:

| **Column Name** | **Table/Model** | **Data Type** | **Source/Origin** | **Processing Logic** | **Purpose** |
|-----------------|-----------------|---------------|-------------------|---------------------|-------------|
| `entity_id` | Coldstorage, ColdstorageMaterial, ColdstoragePerTemperature | INTEGER | Function parameter | Direct assignment | Entity identification |
| `volume_asset` | Coldstorage, ColdstoragePerTemperature | DECIMAL | AssetIot.volume_asset | Direct assignment from IoT data | Physical storage capacity |
| `total_volume` | Coldstorage, ColdstoragePerTemperature | DECIMAL | Calculated | Sum of all material volumes per temperature | Current volume utilization |
| `percentage_capacity` | Coldstorage, ColdstoragePerTemperature | DECIMAL | Calculated | `(total_volume / volume_asset) × 100` | Current capacity percentage |
| `projection_volume_asset` | Coldstorage, ColdstoragePerTemperature | DECIMAL | AssetIot.volume_asset | Same as volume_asset | Projected storage capacity |
| `projection_total_volume` | Coldstorage, ColdstoragePerTemperature | DECIMAL | Calculated | Sum of projected material volumes | Future volume utilization |
| `projection_percentage_capacity` | Coldstorage, ColdstoragePerTemperature | DECIMAL | Calculated | `(projection_total_volume / projection_volume_asset) × 100` | Future capacity percentage |
| `master_material_id` | ColdstorageMaterial | INTEGER | EntityMasterMaterial | Direct assignment | Material identification |
| `dosage_stock` | ColdstorageMaterial | INTEGER | EntityMasterMaterial.on_hand_stock | Direct assignment | Current dosage inventory |
| `vial_stock` | ColdstorageMaterial | DECIMAL | Calculated | `dosage_stock ÷ pieces_per_unit` | Vial count calculation |
| `package_stock` | ColdstorageMaterial | INTEGER | Calculated | `Math.ceil(vial_stock ÷ unit_per_box)` | Package count (rounded up) |
| `package_volume` | ColdstorageMaterial | DECIMAL | Calculated | `package_stock × volume_per_liter` | Total volume for material |
| `projection_dosage_stock` | ColdstorageMaterial | INTEGER | Calculated | `dosage_stock + max_dosage` | Future dosage inventory |
| `projection_vial_stock` | ColdstorageMaterial | DECIMAL | Calculated | `projection_dosage_stock ÷ pieces_per_unit` | Future vial count |
| `projection_package_stock` | ColdstorageMaterial | INTEGER | Calculated | `Math.ceil(projection_vial_stock ÷ unit_per_box)` | Future package count |
| `projection_package_volume` | ColdstorageMaterial | DECIMAL | Calculated | `projection_package_stock × volume_per_liter` | Future total volume |
| `volume_per_liter` | ColdstorageMaterial | DECIMAL | Calculated | `(box_length × box_width × box_height) ÷ 1000` | Volume per package in liters |
| `max_dosage` | ColdstorageMaterial | INTEGER | MasterVolumeMaterialManufacture | Maximum from activities | Maximum required dosage |
| `recommend_order_base_on_max` | ColdstorageMaterial | INTEGER | Calculated | `max_dosage - dosage_stock` (if positive) | Recommended order quantity |
| `remain_package_fulfill` | ColdstorageMaterial | INTEGER | Calculated | `Math.floor((volume_asset - total_volume) ÷ volume_per_liter)` | Remaining capacity in packages |
| `range_temperature_id` | ColdstoragePerTemperature | INTEGER | RangeTemperature | From rangeMaterialData grouping | Temperature range identification |
| `coldstorage_id` | ColdstorageMaterial, ColdstoragePerTemperature | INTEGER | Generated | Auto-increment from Coldstorage creation | Cold storage record ID |

### **Data Flow and Relationships**

1. **Input Sources**:
   - `AssetIot`: Provides physical storage capacity (`volume_asset`)
   - `EntityMasterMaterial`: Provides current stock levels (`on_hand_stock`)
   - `MasterMaterial`: Provides material specifications (dimensions, units)
   - `MasterVolumeMaterialManufacture`: Provides activity-based requirements
   - `RangeTemperature`: Provides temperature categorization

2. **Calculation Dependencies**:
   - Volume calculations depend on material dimensions
   - Stock projections depend on current stock + maximum requirements
   - Capacity percentages depend on volume ratios
   - Temperature-based calculations depend on material temperature requirements

3. **Output Destinations**:
   - `Coldstorage`: Aggregate facility-level metrics
   - `ColdstorageMaterial`: Material-specific storage data
   - `ColdstoragePerTemperature`: Temperature-specific capacity data
   - `ColdstorageTransactionLog`: Audit trail of changes

## Dependencies

### External Services
- **Notification Service**: `generateCapacityNotification()` for capacity alerts
- **Database Models**: Sequelize ORM models for data persistence

### Helper Functions
- **createColdstorageMaterials()**: Initializes material data for new cold storage

## Conclusion

The `processDataColdstorage` function is a comprehensive cold storage management system that:

1. **Calculates Storage Metrics**: Tracks current and projected storage utilization
2. **Manages Temperature Zones**: Handles different temperature requirements for various vaccines
3. **Monitors Capacity**: Provides alerts when storage approaches capacity limits
4. **Projects Future Needs**: Calculates recommended ordering quantities based on usage patterns
5. **Maintains Data Integrity**: Uses transactions to ensure consistent data updates

This function is critical for vaccine supply chain management, ensuring adequate cold storage capacity and proper inventory planning for healthcare facilities.

## Recommendations

1. **Performance**: Consider implementing batch processing for large entities
2. **Monitoring**: Add logging for capacity threshold breaches
3. **Validation**: Implement input validation for entity_id and master_material_id
4. **Documentation**: Add inline comments for complex calculation formulas
5. **Testing**: Implement unit tests for calculation accuracy