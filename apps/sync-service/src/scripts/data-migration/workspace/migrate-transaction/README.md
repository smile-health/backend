## Last 10 days of data
`select * from prod_imun_20250925.transactions t where t.updatedAt >= '2025-09-15 00:00:00';`
**468,143 rows**
But the behavior of data is, even the updated at is on latest date, the created at is very late.

## Data below 2025
where t.updatedAt <= '2025-01-01 00:00:00'
Data from production 3.0: 41,398,084 rows
Data from production 3.0 backup: 41,398,521 rows

Data from backup 3.0 prod_imun_20250925: 41,398,106 rows
Data from backup 3.0 prod_imun_20251005: 41,398,106 rows

## Source table count

| SUMMARY | All source tables count |
|---|---|
| transactions | 51,091,874 |
| transaction_patients | 414,954 |
| transaction_purchase | 131,928 |
| stocks | 3,283,621 |
| batches | 11,438 |
| entities | 902,134 |
| patients | 240,205 |
| users | 49,647 |
| activities | 18 |
| orders | 2,222,407 |
| transaction_reasons | 60 |
| budget_sources | 17 |
| TOTAL | 58,348,303 |

## Count Query
```
SELECT 'SUMMARY' as section, 'All source tables count' as description
UNION ALL
SELECT 'transactions', CAST(COUNT(*) as CHAR) FROM transactions
UNION ALL
SELECT 'transaction_patients', CAST(COUNT(*) as CHAR) FROM transaction_patients
UNION ALL
SELECT 'transaction_purchase', CAST(COUNT(*) as CHAR) FROM transaction_purchase
UNION ALL
SELECT 'stocks', CAST(COUNT(*) as CHAR) FROM stocks
UNION ALL
SELECT 'batches', CAST(COUNT(*) as CHAR) FROM batches
UNION ALL
SELECT 'entities', CAST(COUNT(*) as CHAR) FROM entities
UNION ALL
SELECT 'patients', CAST(COUNT(*) as CHAR) FROM patients
UNION ALL
SELECT 'users', CAST(COUNT(*) as CHAR) FROM users
UNION ALL
SELECT 'activities', CAST(COUNT(*) as CHAR) FROM master_activities ma
UNION ALL
SELECT 'orders', CAST(COUNT(*) as CHAR) FROM orders
UNION ALL
SELECT 'transaction_reasons', CAST(COUNT(*) as CHAR) FROM transaction_reasons
UNION ALL
SELECT 'budget_sources', CAST(COUNT(*) as CHAR) FROM source_materials sm
UNION ALL
SELECT 'TOTAL', CAST(SUM(CAST(description AS SIGNED)) AS CHAR) FROM (
    SELECT 'transactions' as section, COUNT(*) as description FROM transactions
    UNION ALL
    SELECT 'transaction_patients', COUNT(*) FROM transaction_patients
    UNION ALL
    SELECT 'transaction_purchase', COUNT(*) FROM transaction_purchase
    UNION ALL
    SELECT 'stocks', COUNT(*) FROM stocks
    UNION ALL
    SELECT 'batches', COUNT(*) FROM batches
    UNION ALL
    SELECT 'entities', COUNT(*) FROM entities
    UNION ALL
    SELECT 'patients', COUNT(*) FROM patients
    UNION ALL
    SELECT 'users', COUNT(*) FROM users
    UNION ALL
    SELECT 'activities', COUNT(*) FROM master_activities
    UNION ALL
    SELECT 'orders', COUNT(*) FROM orders
    UNION ALL
    SELECT 'transaction_reasons', COUNT(*) FROM transaction_reasons
    UNION ALL
    SELECT 'budget_sources', COUNT(*) FROM source_materials
) AS subquery;
```