-- =====================================================
-- Entity Migration Data Validation Scripts
-- =====================================================
-- This script validates the data integrity after running
-- the parallel entity migration process

-- =====================================================
-- 1. ENTITY ACTIVITIES VALIDATION
-- =====================================================

-- Check total count comparison between source and target
WITH program_validations AS (
    -- Program 2 (Logistics) - Activities 3,7,8,9
    SELECT 
        'Entity Activities Count Validation Program: 2 (Logistics) for activities: 3, 7, 8, 9' as validation_type,
        (SELECT COUNT(*) 
         FROM prod_logistic_20250620.entity_activity_date ea
         INNER JOIN prod_logistic_20250620.entities e ON ea.entity_id = e.id 
         WHERE ea.activity_id IN (3, 7, 8, 9)
         AND e.deleted_at IS NULL
         AND ea.deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250619.ws_entity_activities WHERE activity_id IN (2, 5, 6, 7)) as target_count
    UNION ALL
    -- Program 3 (Malaria) - Activity 1
    SELECT 
        'Entity Activities Count Validation Program: 3 (Malaria) for activities: 1' as validation_type,
        (SELECT COUNT(*) 
         FROM prod_logistic_20250620.entity_activity_date ea
         INNER JOIN prod_logistic_20250620.entities e ON ea.entity_id = e.id
         WHERE ea.activity_id IN (1)
         AND e.deleted_at IS NULL
         AND ea.deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250619.ws_entity_activities WHERE activity_id IN (1)) as target_count
    UNION ALL
    -- Program 4 (TB) - Activity 4
    SELECT 
        'Entity Activities Count Validation Program: 4 (TB) for activities: 4' as validation_type,
        (SELECT COUNT(*) 
         FROM prod_logistic_20250620.entity_activity_date ea
         INNER JOIN prod_logistic_20250620.entities e ON ea.entity_id = e.id
         WHERE ea.activity_id IN (4)
         AND e.deleted_at IS NULL
         AND ea.deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250619.ws_entity_activities WHERE activity_id IN (3)) as target_count
    UNION ALL
    -- Program 5 (HIV) - Activity 5
    SELECT 
        'Entity Activities Count Validation Program: 5 (HIV) for activities: 5' as validation_type,
        (SELECT COUNT(*) 
         FROM prod_logistic_20250620.entity_activity_date ea
         INNER JOIN prod_logistic_20250620.entities e ON ea.entity_id = e.id
         WHERE ea.activity_id IN (5)
         AND e.deleted_at IS NULL
         AND ea.deleted_at IS NULL) as source_count,
        (SELECT COUNT(*) FROM staging_smile5_20250619.ws_entity_activities WHERE activity_id IN (4)) as target_count
)
SELECT 
    validation_type,
    source_count,
    target_count,
    ABS(source_count - target_count) as deviation_count,
    CASE 
        WHEN source_count = target_count THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status,
    source_count + target_count as total_count
FROM program_validations
UNION ALL
SELECT
    'Total' as validation_type,
    SUM(source_count) as source_count,
    SUM(target_count) as target_count,
    ABS(SUM(source_count) - SUM(target_count)) as deviation_count,
    CASE 
        WHEN SUM(source_count) = SUM(target_count) THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status,
    SUM(source_count + target_count) as total_count
FROM program_validations;

-- Entity Activities Count Validation Program: 2 (Logistics) for activities: 3, 7, 8, 9	60346	18975	41371	FAIL	79321
-- Entity Activities Count Validation Program: 3 (Malaria) for activities: 1	18759	18764	5	FAIL	37523
-- Entity Activities Count Validation Program: 4 (TB) for activities: 4	18496	18776	280	FAIL	37272
-- Entity Activities Count Validation Program: 5 (HIV) for activities: 5	18496	201	18295	FAIL	18697
-- Total	116097	56716	59381	FAIL	172813

-- =====================================================
-- 2. CUSTOMER VENDORS VALIDATION
-- =====================================================

-- Check total count comparison for customer vendors
WITH program_validations AS (
    -- Program 2 (Logistics) - Activities 3,7,8,9
    SELECT 
        'Customer Vendors Count Validation Program: 2 (Logistics) for activities: 3, 7, 8, 9' as validation_type,
        (
            SELECT COUNT(*) 
            FROM prod_logistic_20250620.customer_vendors cv
            LEFT JOIN prod_logistic_20250620.entities e ON cv.vendor_id = e.id
            LEFT JOIN prod_logistic_20250620.entity_activity_date ea ON cv.vendor_id = ea.entity_id 
            WHERE e.deleted_at IS NULL
            AND ea.activity_id IN (3, 7, 8, 9)
        ) as source_count,
        (
            SELECT COUNT(*) 
            FROM staging_smile5_20250619.ws_customer_vendors
            WHERE program_id = 2
        ) as target_count
    UNION ALL
    -- Program 3 (Malaria) - Activity 1
    SELECT 
        'Customer Vendors Count Validation Program 3 (Malaria) - Activity 1' as validation_type,
        (
            SELECT COUNT(*) 
            FROM prod_logistic_20250620.customer_vendors cv
            LEFT JOIN prod_logistic_20250620.entities e ON cv.vendor_id = e.id
            LEFT JOIN prod_logistic_20250620.entity_activity_date ea ON cv.vendor_id = ea.entity_id 
            WHERE e.deleted_at IS NULL
            AND ea.activity_id IN (1)
        ) as source_count,
        (
            SELECT COUNT(*) 
            FROM staging_smile5_20250619.ws_customer_vendors
            WHERE program_id = 3
        ) as target_count
    UNION ALL
    -- Program 4 (TB) - Activity 4
    SELECT 
        'Customer Vendors Count Validation Program 4 (TB) - Activity 4' as validation_type,
        (
            SELECT COUNT(*) 
            FROM prod_logistic_20250620.customer_vendors cv
            LEFT JOIN prod_logistic_20250620.entities e ON cv.vendor_id = e.id
            LEFT JOIN prod_logistic_20250620.entity_activity_date ea ON cv.vendor_id = ea.entity_id 
            WHERE e.deleted_at IS NULL
            AND ea.activity_id IN (3)
        ) as source_count,
        (
            SELECT COUNT(*) 
            FROM staging_smile5_20250619.ws_customer_vendors
            WHERE program_id = 4
        ) as target_count
    UNION ALL
    -- Program 5 (HIV) - Activity 5
    SELECT 
        'Customer Vendors Count Validation Program 5 (HIV) - Activity 5' as validation_type,
        (
            SELECT COUNT(*) 
            FROM prod_logistic_20250620.customer_vendors cv
            LEFT JOIN prod_logistic_20250620.entities e ON cv.vendor_id = e.id
            LEFT JOIN prod_logistic_20250620.entity_activity_date ea ON cv.vendor_id = ea.entity_id 
            WHERE e.deleted_at IS NULL
            AND ea.activity_id IN (4)
        ) as source_count,
        (
            SELECT COUNT(*) 
            FROM staging_smile5_20250619.ws_customer_vendors
            WHERE program_id = 5
        ) as target_count
)
SELECT 
    validation_type,
    source_count,
    target_count,
    ABS(source_count - target_count) as deviation_count,
    CASE 
        WHEN source_count = target_count THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status,
    source_count + target_count as total_count
FROM program_validations
UNION ALL
SELECT
    'Total' as validation_type,
    SUM(source_count) as source_count,
    SUM(target_count) as target_count,
    ABS(SUM(source_count) - SUM(target_count)) as deviation_count,
    CASE 
        WHEN SUM(source_count) = SUM(target_count) THEN 'PASS'
        ELSE 'FAIL'
    END as validation_status,
    SUM(source_count + target_count) as total_count
FROM program_validations;

-- Customer Vendors Count Validation Program: 2 (Logistics) for activities: 3, 7, 8, 9	1927423	3215	1924208	FAIL	1930638
-- Customer Vendors Count Validation Program 3 (Malaria) - Activity 1	624948	20171	604777	FAIL	645119
-- Customer Vendors Count Validation Program 4 (TB) - Activity 4	623976	20171	603805	FAIL	644147
-- Customer Vendors Count Validation Program 5 (HIV) - Activity 5	623976	20171	603805	FAIL	644147
-- Total	3800323	63728	3736595	FAIL	3864051