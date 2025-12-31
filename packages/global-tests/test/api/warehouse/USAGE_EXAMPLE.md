# Usage Examples - New Header-Based Approach

## Before (Old Pattern)
```javascript
const res = await WarehouseTestUtils.request()
    .get('/monitoring-stock/chart')
    .query(queryParams);
```

## After (New Pattern)
```javascript
const res = await WarehouseTestUtils.request()
    .get('/monitoring-stock/chart')
    .set(WarehouseTestUtils.getHeaders())
    .query(queryParams);
```

## Different Header Scenarios

### 1. Authenticated Request (Default)
```javascript
const res = await WarehouseTestUtils.request()
    .get('/endpoint')
    .set(WarehouseTestUtils.getHeaders())
    .query(params);
```

### 2. Unauthenticated Request
```javascript
const res = await WarehouseTestUtils.request()
    .get('/endpoint')
    .set(WarehouseTestUtils.getUnauthenticatedHeaders())
    .query(params);
```

### 3. Invalid Token
```javascript
const res = await WarehouseTestUtils.request()
    .get('/endpoint')
    .set(WarehouseTestUtils.getInvalidTokenHeaders())
    .query(params);
```

### 4. Expired Token
```javascript
const res = await WarehouseTestUtils.request()
    .get('/endpoint')
    .set(WarehouseTestUtils.getExpiredTokenHeaders())
    .query(params);
```

### 5. Custom Token
```javascript
const customToken = 'your_custom_token_here';
const res = await WarehouseTestUtils.request()
    .get('/endpoint')
    .set(WarehouseTestUtils.getHeaders(customToken))
    .query(params);
```

## Benefits
- **Cleaner**: Headers are centralized and reusable
- **Flexible**: Easy to switch between different auth scenarios
- **Consistent**: Same pattern across all test files
- **Debuggable**: Easy to inspect headers being sent
- **Modular**: Headers can be composed or modified as needed