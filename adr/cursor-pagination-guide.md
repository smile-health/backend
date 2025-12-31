# Cursor-Based Pagination Implementation Guide

## Overview

This guide explains the cursor-based pagination implementation for the transaction list feature. Cursor-based pagination provides better performance and consistency compared to traditional offset-based pagination, especially for large datasets.

## Benefits of Cursor-Based Pagination

1. **Performance**: No OFFSET clause means faster queries on large datasets
2. **Consistency**: No duplicate or missing records when data changes during pagination
3. **Scalability**: Performance doesn't degrade as you paginate deeper
4. **Real-time friendly**: Works well with frequently updated data

## Implementation Details

### New Files Created

- `packages/lib/types/cursor-paginate.ts` - Core cursor pagination types and utilities

### Modified Files

- `transaction.schema.ts` - Added `TransactionListCursorPaginatedRequestSchema`
- `transaction.repository.ts` - Added `getTransactionListCursor` method
- `transaction.module.ts` - Added `getTransactionListCursor` method
- `transaction.controller.ts` - Added `/cursor` endpoint

## API Usage

### Endpoint

```
GET /api/transactions/cursor
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `paginate` | number | No | Number of records to return (10, 25, 50, 100). Default: 50 |
| `cursor` | string | No | Base64 encoded cursor for pagination |
| `keyword` | string | No | Search keyword |
| `transaction_type_id` | number | No | Filter by transaction type |
| `transaction_reason_id` | number | No | Filter by transaction reason |
| `material_id` | number | No | Filter by material |
| `entity_id` | number | No | Filter by entity |
| `start_date` | string | No | Filter by start date (ISO format) |
| `end_date` | string | No | Filter by end date (ISO format) |
| `is_order` | string | No | Filter by order status ("0" or "1") |

### Response Format

```json
{
  "paginate": 50,
  "has_next_page": true,
  "has_previous_page": false,
  "next_cursor": "eyJpZCI6MTIzLCJjcmVhdGVkX2F0IjoiMjAyNC0wMS0xNVQxMDowMDowMFoifQ==",
  "previous_cursor": null,
  "total_count": null,
  "data": [
    {
      "id": 123,
      "transaction_type_id": 1,
      "transaction_type_name": "Purchase",
      "material_name": "Product A",
      "entity_name": "Entity 1",
      "qty": 10,
      "price": 100.00,
      "total_price": 1000.00,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

## Usage Examples

### 1. First Page Request

```bash
curl "http://localhost:3000/api/transactions/cursor?paginate=25"
```

### 2. Next Page Request

```bash
curl "http://localhost:3000/api/transactions/cursor?paginate=25&cursor=eyJpZCI6MTIzLCJjcmVhdGVkX2F0IjoiMjAyNC0wMS0xNVQxMDowMDowMFoifQ=="
```

### 3. Filtered Request

```bash
curl "http://localhost:3000/api/transactions/cursor?paginate=25&transaction_type_id=1&start_date=2024-01-01T00:00:00Z"
```

### 4. Search Request

```bash
curl "http://localhost:3000/api/transactions/cursor?paginate=25&keyword=product"
```

## Frontend Implementation Example

### React Hook for Cursor Pagination

```typescript
import { useState, useEffect } from 'react';

interface UseCursorPaginationProps {
  endpoint: string;
  paginate?: number;
  filters?: Record<string, any>;
}

interface CursorPaginationState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor: string | null;
  previousCursor: string | null;
}

export function useCursorPagination<T>({
  endpoint,
  paginate = 25,
  filters = {}
}: UseCursorPaginationProps) {
  const [state, setState] = useState<CursorPaginationState<T>>({
    data: [],
    loading: false,
    error: null,
    hasNextPage: false,
    hasPreviousPage: false,
    nextCursor: null,
    previousCursor: null
  });

  const fetchData = async (cursor?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const params = new URLSearchParams({
        paginate: paginate.toString(),
        ...filters,
        ...(cursor && { cursor })
      });
      
      const response = await fetch(`${endpoint}?${params}`);
      const result = await response.json();
      
      setState({
        data: result.data,
        loading: false,
        error: null,
        hasNextPage: result.has_next_page,
        hasPreviousPage: result.has_previous_page,
        nextCursor: result.next_cursor,
        previousCursor: result.previous_cursor
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      }));
    }
  };

  const loadNext = () => {
    if (state.nextCursor && !state.loading) {
      fetchData(state.nextCursor);
    }
  };

  const loadPrevious = () => {
    if (state.previousCursor && !state.loading) {
      fetchData(state.previousCursor);
    }
  };

  const refresh = () => {
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [endpoint, paginate, JSON.stringify(filters)]);

  return {
    ...state,
    loadNext,
    loadPrevious,
    refresh
  };
}
```

### React Component Example

```typescript
import React from 'react';
import { useCursorPagination } from './useCursorPagination';

interface Transaction {
  id: number;
  material_name: string;
  entity_name: string;
  qty: number;
  price: number;
  total_price: number;
  created_at: string;
}

export function TransactionList() {
  const {
    data,
    loading,
    error,
    hasNextPage,
    hasPreviousPage,
    loadNext,
    loadPrevious,
    refresh
  } = useCursorPagination<Transaction>({
    endpoint: '/api/transactions/cursor',
    paginate: 25,
    filters: {
      // Add your filters here
      // transaction_type_id: 1,
      // start_date: '2024-01-01T00:00:00Z'
    }
  });

  if (loading && data.length === 0) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <button onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </div>
      
      <table className="w-full border-collapse border">
        <thead>
          <tr>
            <th className="border p-2">ID</th>
            <th className="border p-2">Material</th>
            <th className="border p-2">Entity</th>
            <th className="border p-2">Quantity</th>
            <th className="border p-2">Price</th>
            <th className="border p-2">Total</th>
            <th className="border p-2">Created At</th>
          </tr>
        </thead>
        <tbody>
          {data.map((transaction) => (
            <tr key={transaction.id}>
              <td className="border p-2">{transaction.id}</td>
              <td className="border p-2">{transaction.material_name}</td>
              <td className="border p-2">{transaction.entity_name}</td>
              <td className="border p-2">{transaction.qty}</td>
              <td className="border p-2">${transaction.price}</td>
              <td className="border p-2">${transaction.total_price}</td>
              <td className="border p-2">
                {new Date(transaction.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="mt-4 flex justify-between">
        <button
          onClick={loadPrevious}
          disabled={!hasPreviousPage || loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          Previous
        </button>
        
        <button
          onClick={loadNext}
          disabled={!hasNextPage || loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          {loading ? 'Loading...' : 'Next'}
        </button>
      </div>
    </div>
  );
}
```

## Migration Strategy

### Phase 1: Parallel Implementation
- Keep existing offset-based endpoints (`/api/transactions/`)
- Add new cursor-based endpoints (`/api/transactions/cursor`)
- Both endpoints coexist

### Phase 2: Frontend Migration
- Update frontend components to use cursor-based pagination
- Test thoroughly with real data
- Monitor performance improvements

### Phase 3: Deprecation (Optional)
- Mark offset-based endpoints as deprecated
- Eventually remove offset-based endpoints if no longer needed

## Performance Considerations

1. **Index Requirements**: Ensure proper indexes on `(created_at, id)` for optimal performance
2. **Cursor Encoding**: Cursors are base64 encoded JSON, keep them lightweight
3. **Limit Validation**: Enforce reasonable limits to prevent abuse
4. **Caching**: Consider caching strategies for frequently accessed data

## Troubleshooting

### Common Issues

1. **Invalid Cursor Error**
   - Cause: Malformed or expired cursor
   - Solution: Start pagination from the beginning

2. **Performance Issues**
   - Cause: Missing database indexes
   - Solution: Add composite index on `(created_at, id)`

3. **Inconsistent Results**
   - Cause: Data changes during pagination
   - Solution: This is expected behavior; cursor pagination handles this gracefully

### Database Index Recommendations

```sql
-- For optimal cursor pagination performance
CREATE INDEX idx_transactions_cursor ON ws_transaction_lists (created_at DESC, transaction_id DESC);

-- For filtered queries
CREATE INDEX idx_transactions_type_cursor ON ws_transaction_lists (transaction_type_id, created_at DESC, transaction_id DESC);
CREATE INDEX idx_transactions_entity_cursor ON ws_transaction_lists (entity_id, created_at DESC, transaction_id DESC);
```

## Conclusion

Cursor-based pagination provides a more scalable and consistent approach to handling large datasets. The implementation maintains backward compatibility while offering improved performance for modern applications.