# Stock Recovery Tracking API Documentation

## Overview

The Stock Recovery Tracking module measures how long it takes for stock to recover from a **zero state** (out of stock) back to a **normal state** (adequate stock levels). This provides critical insights into supply chain resilience and restocking efficiency.

**Transaction Type**: `normal`  
**Module**: Stock Inventory Query System  
**Purpose**: Track recovery duration and frequency from stockouts to normal inventory levels

---

## Core Concept

### What is Stock Recovery?

A **recovery period** is defined as the time span from when stock reaches zero until it returns to a normal state (within EMA min/max thresholds).

```
Timeline: zero → min → max → normal
          ^_____Recovery Period_____^
```

### Key Metrics

1. **Recovery Duration**: Total time (in seconds) spent recovering from zero to normal
2. **Recovery Frequency**: Number of completed recovery cycles in the period

---

## Business Logic

### Stock State Classification

Each transaction's stock balance is classified into one of five states:

| State       | Condition                   | Description                     |
| ----------- | --------------------------- | ------------------------------- |
| `zero`      | balance ≤ 0                 | Out of stock                    |
| `min`       | 0 < balance < EMA_min       | Below minimum threshold         |
| `max`       | balance > EMA_max           | Above maximum threshold         |
| `normal`    | EMA_min ≤ balance ≤ EMA_max | Optimal stock level             |
| `available` | balance > 0 (no thresholds) | Stock exists but no EMA defined |

### Recovery Tracking Rules

#### Rule 1: Track Each Zero-to-Normal Recovery

Each time stock enters zero state and subsequently reaches normal state, it counts as one recovery period.

**Example:**

```
zero → min → normal → max → zero → min → normal
^___Recovery 1_____^         ^___Recovery 2_____^
```

- **Recovery 1**: 3 transactions, duration = T1→T2 + T2→T3
- **Recovery 2**: 3 transactions, duration = T5→T6 + T6→T7
- **Total Frequency**: 2

#### Rule 2: Ignore Subsequent Zeros During Active Recovery

If stock enters zero again before completing the current recovery, ignore the subsequent zero.

**Example:**

```
zero → min → zero → max → normal
^_________Recovery 1__________^
          (T3 ignored)
```

- **Recovery 1**: Tracks from first zero (T1) to first normal (T5)
- **T3 (second zero)**: Ignored because recovery from T1 is still in progress
- **Total Frequency**: 1

#### Rule 3: Multiple Recoveries Per Period

A single time period (day/week/month) can contain multiple independent recovery cycles.

**Example:**

```
zero → normal → max → zero → normal
^_Recovery 1_^         ^_Recovery 2_^
```

- **Recovery 1**: T1 → T2
- **Recovery 2**: T4 → T5
- **Total Frequency**: 2

---

## Technical Implementation

### Query Architecture

The recovery tracking uses a multi-stage CTE (Common Table Expression) pipeline:

```sql
WITH
  transactions_with_state AS (
    -- Classify each transaction's stock condition
  ),
  transactions_with_recovery_base AS (
    -- Track cumulative counts of 'normal' and 'zero' states
  ),
  transactions_with_recovery AS (
    -- Create recovery groups
  ),
  transactions_with_recovery_flags AS (
    -- Mark recovery start/end and in-progress flags
  ),
  aggregated_by_period AS (
    -- Aggregate metrics by entity-material-period
  )
SELECT ...
```

### Recovery Group Algorithm

**Step 1: Track State Counts**

```sql
normal_count_before = COUNT(normal states before current transaction)
zero_entry_count_before = COUNT(zero entries before current transaction)
```

**Step 2: Increment Recovery Group**

```sql
IF (
  previous_condition != 'zero'
  AND current_condition == 'zero'
  AND normal_count_before >= zero_entry_count_before
) THEN
  recovery_group++
```

**Logic**: Only increment when entering zero AND the previous recovery has completed (reached normal).

**Step 3: Mark Recovery Boundaries**

```sql
recovery_start_txn_id = MIN(txn_id WHERE condition == 'zero' IN recovery_group)
recovery_end_txn_id = MIN(txn_id WHERE condition == 'normal' IN recovery_group)
recovery_in_progress = (txn_id BETWEEN recovery_start_txn_id AND recovery_end_txn_id)
```

### Missing Data Filling Algorithm

**Function**: `fillAndCalculateMissingData()`

**Purpose**: Ensures continuous time-series data by filling gaps in periods where no transactions occurred for an entity-material combination. This is critical for accurate duration calculations across incomplete datasets.

**Key Responsibilities**:

1. **Gap Detection**: Identifies missing periods in the time series for each entity-material group
2. **Data Interpolation**: Creates synthetic data points for missing periods based on the last known state
3. **Duration Propagation**: Calculates appropriate duration values for missing periods based on transaction type and stock conditions
4. **State Continuity**: Maintains stock condition state across gaps to ensure accurate recovery tracking

**Algorithm Steps**:

**Step 1: Group by Composite Key**

```typescript
compositeKey = `${entity_id}_${master_material_id}`;
groupedData = groupBy(stockData, compositeKey);
```

**Step 2: Initialize Period Array**

```typescript
// Add baseline period (1970-01-01 or 1970-01) to track historical state
copyPeriods = ["1970-01", ...actualPeriods];
```

**Step 3: Iterate Through All Periods**

For each period in the complete timeline:

- **Case A: First Period (1970 baseline)**
  - Create a "past data" entry with all metrics set to `null`
  - Set `total_duration_seconds = -1` and `total_frequency = -1` to indicate historical data
  - Preserve `opening_previous_stock_condition` from first actual transaction

- **Case B: Missing Period (no transaction data)**
  - Clone the latest existing entry
  - Update `period` to the missing period identifier
  - Set all opening/middle/closing metrics to `null`
  - Calculate `total_duration_seconds` based on transaction type:
    - If previous closing condition matches transaction type criteria → duration = period duration
    - Otherwise → duration = 0
  - Set `total_frequency = 0` (no new events in missing period)

- **Case C: Existing Period (has transaction data)**
  - Use actual data from query results
  - Update `future_immediate_balance_condition` to link to next period's opening state
  - Remove from processing queue to avoid duplication

**Step 4: Duration Calculation Logic for Missing Data**

```typescript
if (
  checkPreviousEhmmBalance(
    closing_current_stock_condition,
    future_immediate_balance_condition,
    transactionType
  )
) {
  total_duration_seconds = periodDuration; // Full period duration
} else {
  total_duration_seconds = 0; // Condition not met
}
```

**Transaction Type Rules**:

| Transaction Type | Duration Assigned When                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| `zero`           | Previous closing state is `zero`                                            |
| `min`            | Previous closing state is `min`                                             |
| `max`            | Previous closing state is `max`                                             |
| `normal`         | Previous closing is `zero` AND next opening is `normal` (recovery complete) |
| `availability`   | Previous closing state is NOT `zero`                                        |

**Example Scenario**:

```
Actual Data:
  2025-01: zero → normal (recovery completed)
  2025-03: normal → max

Missing Period: 2025-02

Filled Data for 2025-02:
  - period: '2025-02'
  - opening_ehmm_balance: null
  - closing_current_stock_condition: 'normal' (from 2025-01 closing)
  - future_immediate_balance_condition: 'normal' (from 2025-03 opening)
  - total_duration_seconds: 0 (no active recovery in Feb)
  - total_frequency: 0
```

**Why This Matters**:

- **Accurate Aggregations**: Frontend can sum durations across all periods without gaps
- **Trend Visualization**: Charts display continuous lines instead of broken segments
- **State Tracking**: Recovery states persist correctly across time gaps
- **Null Semantics**: `null` values indicate "no transaction data" vs `0` which means "measured as zero"

### Duration Calculation

```sql
middle_duration = SUM(
  dateDiff('second', current_txn_time, next_txn_time)
  WHERE recovery_in_progress == 1
)
```

### Frequency Calculation

```sql
middle_frequency = COUNT(
  WHERE current_condition == 'normal'
  AND recovery_start_flag == 1
)
```

---

## Detailed Example Walkthrough

### Scenario: Multiple Recoveries with Ignored Zero

**Input Transactions:**

```
T1: zero (balance=0)
T2: min (balance=5, EMA_min=10)
T3: zero (balance=0)  ← Should be ignored
T4: normal (balance=15, EMA_min=10, EMA_max=50)
T5: normal (balance=20)
T6: min (balance=8)
T7: max (balance=55, EMA_max=50)
T8: zero (balance=0)
T9: min (balance=7)
T10: normal (balance=18)
```

### Processing Steps

**Step 1: Classify States**
| Txn | Balance | State | Previous State |
|-----|---------|-------|----------------|
| T1 | 0 | zero | (initial) |
| T2 | 5 | min | zero |
| T3 | 0 | zero | min |
| T4 | 15 | normal| zero |
| T5 | 20 | normal| normal |
| T6 | 8 | min | normal |
| T7 | 55 | max | min |
| T8 | 0 | zero | max |
| T9 | 7 | min | zero |
| T10 | 18 | normal| min |

**Step 2: Calculate Counts**
| Txn | normal_count_before | zero_entry_count_before |
|-----|---------------------|-------------------------|
| T1 | 0 | 0 |
| T2 | 0 | 1 |
| T3 | 0 | 1 |
| T4 | 0 | 1 |
| T5 | 1 | 1 |
| T6 | 2 | 1 |
| T7 | 2 | 1 |
| T8 | 2 | 1 |
| T9 | 2 | 2 |
| T10 | 2 | 2 |

**Step 3: Determine Recovery Groups**
| Txn | Condition Check | Recovery Group |
|-----|-----------------|----------------|
| T1 | prev != 'zero' AND curr == 'zero' AND 0 >= 0 → **TRUE** | 1 |
| T2 | FALSE | 1 |
| T3 | prev != 'zero' AND curr == 'zero' AND 0 >= 1 → **FALSE** | 1 ✓ (ignored!) |
| T4 | FALSE | 1 |
| T5 | FALSE | 1 |
| T6 | FALSE | 1 |
| T7 | FALSE | 1 |
| T8 | prev != 'zero' AND curr == 'zero' AND 2 >= 1 → **TRUE** | 2 |
| T9 | FALSE | 2 |
| T10 | FALSE | 2 |

**Step 4: Mark Recovery Flags**
| Txn | recovery_in_progress | recovery_start_flag |
|-----|---------------------|---------------------|
| T1 | 1 | 0 |
| T2 | 1 | 0 |
| T3 | 1 | 0 |
| T4 | 1 | **1** (first normal in group 1) |
| T5 | 0 | 0 |
| T6 | 0 | 0 |
| T7 | 0 | 0 |
| T8 | 1 | 0 |
| T9 | 1 | 0 |
| T10 | 1 | **1** (first normal in group 2) |

**Step 5: Calculate Metrics**

**Duration:**

- Group 1: (T1→T2) + (T2→T3) + (T3→T4) = 3 intervals
- Group 2: (T8→T9) + (T9→T10) = 2 intervals
- **Total**: 5 intervals worth of seconds

**Frequency:**

- T4: recovery_start_flag = 1 → Count 1
- T10: recovery_start_flag = 1 → Count 1
- **Total**: 2 recoveries

---

## API Response Structure

### Query Parameters

```typescript
{
  from: DateTime,              // Start date (Asia/Jakarta timezone)
  to: DateTime,                // End date (Asia/Jakarta timezone)
  period: 'day' | 'week' | 'month',
  province_id?: number,
  regency_id?: number,
  entity_id?: number,
  entity_tag_ids?: number[],
  material_ids?: number[],
  material_level_id?: number,  // KFA_LEVEL_CODE.TEMPLATE | VARIANT
  material_type_ids?: number[],
  activity_ids?: number[]
}
```

### Response Data Structure

```typescript
{
  province_id: number,
  regency_id: number,
  entity_id: number,
  location_id: number,          // Dynamic based on filters
  master_material_id: number,
  period: string,               // 'YYYY-MM' | 'YYYY-WW' | 'YYYY-MM-DD'

  // Opening snapshot (first transaction)
  opening_ehmm_balance: number,
  opening_change_qty: number,
  opening_ehmm_min: number,
  opening_ehmm_max: number,
  opening_previous_stock_condition: string,
  opening_current_stock_condition: string,

  // Middle metrics (during period)
  middle_ehmm_duration: number,      // Recovery duration in seconds
  middle_ehmm_frequency: number,     // Number of recoveries

  // Closing snapshot (last transaction)
  closing_ehmm_balance: number,
  closing_change_qty: number,
  closing_ehmm_min: number,
  closing_ehmm_max: number,
  closing_current_stock_condition: string,
  closing_previous_stock_condition: string,
  closing_recovery_in_progress: number,    // 0 or 1
  closing_recovery_start_flag: number,     // 0 or 1

  // Offset calculations
  opening_offset_duration: number,   // Seconds from period start to first txn
  closing_offset_duration: number,   // Seconds from last txn to period end
  opening_offset_frequency: number,  // 0 or 1
  closing_offset_frequency: number,  // 0 or 1

  // Totals
  total_duration_seconds: number,    // Sum of all recovery durations
  total_frequency: number            // Total number of recoveries
}
```

---

## Use Cases and Insights

### 1. Supply Chain Performance

**Question**: How quickly can entities restock after running out?

**Metric**: Average recovery duration

```sql
AVG(total_duration_seconds) / 3600  -- Convert to hours
```

**Insight**: Entities with shorter recovery times have more efficient supply chains.

### 2. Stockout Frequency

**Question**: How often do entities experience stockouts?

**Metric**: Recovery frequency

```sql
SUM(total_frequency) / COUNT(DISTINCT entity_id)
```

**Insight**: Higher frequency indicates recurring stockout issues.

### 3. Material-Specific Challenges

**Question**: Which materials have the longest recovery times?

**Metric**: Recovery duration by material

```sql
GROUP BY master_material_id
ORDER BY AVG(total_duration_seconds) DESC
```

**Insight**: Materials with long recovery times may need buffer stock or alternative suppliers.

### 4. Geographic Performance

**Question**: Which regions recover fastest from stockouts?

**Metric**: Recovery duration by location

```sql
GROUP BY province_id, regency_id
ORDER BY AVG(total_duration_seconds) ASC
```

**Insight**: Identifies regions with efficient vs. problematic logistics.

### 5. Trend Analysis

**Question**: Are recovery times improving over time?

**Metric**: Period-over-period comparison

```sql
SELECT
  period,
  AVG(total_duration_seconds) as avg_recovery_time
GROUP BY period
ORDER BY period
```

**Insight**: Tracks effectiveness of supply chain improvements.

---

## Edge Cases and Handling

### Case 1: Period Starts with Zero

```
Period: Jan 1 - Jan 31
First Transaction: Jan 1, 00:00 (zero state)
```

**Handling**: `opening_offset_duration` captures time from period start to first transaction if recovery is in progress.

### Case 2: Period Ends Before Recovery Completes

```
Last Transaction: Jan 28 (zero state)
Period End: Jan 31, 23:59:59
```

**Handling**: `closing_offset_duration` captures time from last transaction to period end if recovery is in progress.

### Case 3: No Recovery in Period

```
All transactions: zero → min → max (never reaches normal)
```

**Handling**:

- `total_frequency` = 0
- `total_duration_seconds` = 0
- `recovery_in_progress` may be 1 if still recovering

### Case 4: Immediate Recovery

```
zero → normal (single transition)
```

**Handling**:

- `total_frequency` = 1
- `total_duration_seconds` = time between two transactions

### Case 5: No Zero State in Period

```
All transactions: normal → max → normal
```

**Handling**:

- `total_frequency` = 0
- `total_duration_seconds` = 0
- No recovery groups created

---

## Comparison with Other Transaction Types

| Transaction Type | What It Tracks             | Duration Meaning              | Frequency Meaning               |
| ---------------- | -------------------------- | ----------------------------- | ------------------------------- |
| `availability`   | Stock available (not zero) | Time spent with stock         | Times stock became available    |
| `zero`           | Out of stock               | Time spent at zero            | Times stock ran out (24hr+)     |
| `min`            | Below minimum              | Time spent below min          | Times dropped below min (24hr+) |
| `max`            | Above maximum              | Time spent above max          | Times exceeded max (24hr+)      |
| **`normal`**     | **Recovery to normal**     | **Time to recover from zero** | **Number of recoveries**        |

**Key Difference**: `normal` type tracks the **journey** from zero to normal, while other types track **time spent in a state**.

---

## Version History

- **v1.0** (Nov 2025): Initial implementation with multi-recovery support
  - Track multiple recoveries per period
  - Ignore subsequent zeros during active recovery
  - Support for day/week/month periods
  - Opening/closing offset calculations
