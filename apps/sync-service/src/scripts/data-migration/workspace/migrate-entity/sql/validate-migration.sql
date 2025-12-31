-- =====================================================
-- Entity Migration Data Validation Scripts
-- =====================================================
-- This script validates the data integrity after running
-- the parallel entity migration process

-- =====================================================
-- 1. ENTITY ACTIVITIES VALIDATION
-- =====================================================

-- Check total count comparison between source and target
SELECT 
    'Entity Activities Count Validation' as validation_type,
    (
        SELECT COUNT(*) 
        FROM prod_logistic_20250620.entity_activities ea
        INNER JOIN prod_logistic_20250620.entities e ON ea.entity_id = e.id
        WHERE e.program_id = 2 -- Source program
    ) as source_count,
    (
        SELECT COUNT(*) 
        FROM staging_smile5_20250619.ws_entity_activities
    ) as target_count,
    CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM prod_logistic_20250620.entity_activities ea
            INNER JOIN prod_logistic_20250620.entities e ON ea.entity_id = e.id
            WHERE e.program_id = 2
        ) = (
            SELECT COUNT(*) 
            FROM staging_smile5_20250619.ws_entity_activities
        ) THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status;

-- Check for orphaned records (entity_id not found in ws_entities)
SELECT 
    'Orphaned Entity Activities' as validation_type,
    COUNT(*) as orphaned_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status
FROM staging_smile5_20250619.ws_entity_activities wea
LEFT JOIN staging_smile5_20250619.ws_entities we ON wea.entity_id = we.id
WHERE we.id IS NULL;

-- Check for orphaned records (activity_id not found in activities)
SELECT 
    'Orphaned Activity References' as validation_type,
    COUNT(*) as orphaned_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status
FROM staging_smile5_20250619.ws_entity_activities wea
LEFT JOIN staging_smile5_20250619.activities a ON wea.activity_id = a.id
WHERE a.id IS NULL;

-- =====================================================
-- 2. CUSTOMER VENDORS VALIDATION
-- =====================================================

-- Check total count comparison for customer vendors
SELECT 
    'Customer Vendors Count Validation' as validation_type,
    (
        SELECT COUNT(*) 
        FROM prod_logistic_20250620.customer_vendors cv
        INNER JOIN prod_logistic_20250620.entities e ON cv.entity_id = e.id
        WHERE e.program_id = 2
    ) as source_count,
    (
        SELECT COUNT(*) 
        FROM staging_smile5_20250619.ws_customer_vendors
    ) as target_count,
    CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM prod_logistic_20250620.customer_vendors cv
            INNER JOIN prod_logistic_20250620.entities e ON cv.entity_id = e.id
            WHERE e.program_id = 2
        ) = (
            SELECT COUNT(*) 
            FROM staging_smile5_20250619.ws_customer_vendors
        ) THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status;

-- Check for orphaned customer vendor records
SELECT 
    'Orphaned Customer Vendors' as validation_type,
    COUNT(*) as orphaned_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status
FROM staging_smile5_20250619.ws_customer_vendors wcv
LEFT JOIN staging_smile5_20250619.ws_entities we ON wcv.entity_id = we.id
WHERE we.id IS NULL;

-- =====================================================
-- 3. ENTITY MATERIAL ACTIVITIES VALIDATION
-- =====================================================

-- Check total count comparison for entity material activities
SELECT 
    'Entity Material Activities Count Validation' as validation_type,
    (
        SELECT COUNT(*) 
        FROM prod_logistic_20250620.entity_material_activities ema
        INNER JOIN prod_logistic_20250620.entities e ON ema.entity_id = e.id
        WHERE e.program_id = 2
    ) as source_count,
    (
        SELECT COUNT(*) 
        FROM staging_smile5_20250619.ws_entity_material_activities
    ) as target_count,
    CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM prod_logistic_20250620.entity_material_activities ema
            INNER JOIN prod_logistic_20250620.entities e ON ema.entity_id = e.id
            WHERE e.program_id = 2
        ) = (
            SELECT COUNT(*) 
            FROM staging_smile5_20250619.ws_entity_material_activities
        ) THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status;

-- Check for orphaned entity material activity records
SELECT 
    'Orphaned Entity Material Activities' as validation_type,
    COUNT(*) as orphaned_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status
FROM staging_smile5_20250619.ws_entity_material_activities wema
LEFT JOIN staging_smile5_20250619.ws_entities we ON wema.entity_id = we.id
WHERE we.id IS NULL;

-- =====================================================
-- 4. PROGRAM-SPECIFIC VALIDATION
-- =====================================================

-- Validate that activities are correctly filtered by logistics mapping
SELECT 
    'Logistics Activities Mapping Validation' as validation_type,
    COUNT(*) as invalid_activities,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status
FROM staging_smile5_20250619.ws_entity_activities wea
INNER JOIN staging_smile5_20250619.ws_entities we ON wea.entity_id = we.id
WHERE wea.activity_id NOT IN (
    -- These should match the activity IDs from MAP_LOGISTICS_PROGRAM_ACTIVITIES
    -- Update these values based on your actual mapping
    SELECT DISTINCT activity_id 
    FROM (
        -- Program 1 activities (example - update with actual IDs)
        SELECT 1 as activity_id UNION ALL
        SELECT 2 as activity_id UNION ALL
        SELECT 3 as activity_id UNION ALL
        -- Program 3 activities (example - update with actual IDs)
        SELECT 4 as activity_id UNION ALL
        SELECT 5 as activity_id UNION ALL
        SELECT 6 as activity_id
        -- Add more activity IDs based on MAP_LOGISTICS_PROGRAM_ACTIVITIES
    ) as logistics_activities
);

-- =====================================================
-- 5. DATA INTEGRITY CHECKS
-- =====================================================

-- Check for duplicate entity-activity combinations
SELECT 
    'Duplicate Entity Activities' as validation_type,
    COUNT(*) as duplicate_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status
FROM (
    SELECT entity_id, activity_id, COUNT(*) as cnt
    FROM staging_smile5_20250619.ws_entity_activities
    GROUP BY entity_id, activity_id
    HAVING COUNT(*) > 1
) duplicates;

-- Check for null values in critical fields
SELECT 
    'Null Values in Entity Activities' as validation_type,
    COUNT(*) as null_count,
    CASE 
        WHEN COUNT(*) = 0 THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status
FROM staging_smile5_20250619.ws_entity_activities
WHERE entity_id IS NULL OR activity_id IS NULL;

-- =====================================================
-- 6. PERFORMANCE METRICS
-- =====================================================

-- Show migration statistics per program
SELECT 
    we.program_id,
    COUNT(DISTINCT wea.entity_id) as migrated_entities,
    COUNT(wea.id) as total_entity_activities,
    AVG(activities_per_entity.activity_count) as avg_activities_per_entity
FROM staging_smile5_20250619.ws_entity_activities wea
INNER JOIN staging_smile5_20250619.ws_entities we ON wea.entity_id = we.id
INNER JOIN (
    SELECT entity_id, COUNT(*) as activity_count
    FROM staging_smile5_20250619.ws_entity_activities
    GROUP BY entity_id
) activities_per_entity ON wea.entity_id = activities_per_entity.entity_id
GROUP BY we.program_id
ORDER BY we.program_id;

-- Show table sizes after migration
SELECT 
    'ws_entity_activities' as table_name,
    COUNT(*) as record_count,
    ROUND((
        SELECT SUM(data_length + index_length) / 1024 / 1024
        FROM information_schema.tables 
        WHERE table_schema = 'platform' 
        AND table_name = 'ws_entity_activities'
    ), 2) as size_mb
FROM staging_smile5_20250619.ws_entity_activities

UNION ALL

SELECT 
    'ws_customer_vendors' as table_name,
    COUNT(*) as record_count,
    ROUND((
        SELECT SUM(data_length + index_length) / 1024 / 1024
        FROM information_schema.tables 
        WHERE table_schema = 'platform' 
        AND table_name = 'ws_customer_vendors'
    ), 2) as size_mb
FROM staging_smile5_20250619.ws_customer_vendors

UNION ALL

SELECT 
    'ws_entity_material_activities' as table_name,
    COUNT(*) as record_count,
    ROUND((
        SELECT SUM(data_length + index_length) / 1024 / 1024
        FROM information_schema.tables 
        WHERE table_schema = 'platform' 
        AND table_name = 'ws_entity_material_activities'
    ), 2) as size_mb
FROM staging_smile5_20250619.ws_entity_material_activities;

-- =====================================================
-- 7. SUMMARY REPORT
-- =====================================================

-- Final validation summary
SELECT 
    'MIGRATION VALIDATION SUMMARY' as report_type,
    CONCAT(
        'Total Entity Activities: ', 
        (SELECT COUNT(*) FROM staging_smile5_20250619.ws_entity_activities),
        ' | Total Customer Vendors: ',
        (SELECT COUNT(*) FROM staging_smile5_20250619.ws_customer_vendors),
        ' | Total Entity Material Activities: ',
        (SELECT COUNT(*) FROM staging_smile5_20250619.ws_entity_material_activities)
    ) as summary;