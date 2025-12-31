# Warehouse Service API Test Suite

This comprehensive test suite validates all endpoints from the warehouse-service module, ensuring robust API functionality, performance, and data integrity.

## Test Structure

### Core Test Files

1. **`base-warehouse.test.js`** - Base utilities and authentication setup
2. **`auth.test.js`** - Authentication and authorization tests
3. **`consumption-supply.test.js`** - Consumption Supply module tests
4. **`monitoring-stock.test.js`** - Monitoring Stock module tests
5. **`stock-book.test.js`** - Stock Book module tests
6. **`reconciliation.test.js`** - Reconciliation module tests
7. **`performance.test.js`** - Performance benchmarks and load testing
8. **`data-integrity.test.js`** - Data validation and integrity checks

## Test Coverage

### Authentication & Authorization (`auth.test.js`)
- ✅ Valid token scenarios
- ✅ Invalid/expired token handling
- ✅ Role-based access control verification
- ✅ Device type restrictions
- ✅ Security headers validation
- ✅ Session management

### Consumption Supply Module (`consumption-supply.test.js`)
- ✅ GET `/consumption-supply/all` - Overview endpoint
- ✅ GET `/consumption-supply/location` - Location master data
- ✅ GET `/consumption-supply/entity` - Entity master data
- ✅ GET `/consumption-supply/material` - Material master data
- ✅ GET `/consumption-supply/export` - Excel export
- ✅ GET `/consumption-supply/period-switcher` - Period switching
- ✅ GET `/consumption-supply/interval-period` - Period intervals
- ✅ GET `/consumption-supply/last-updated` - Last updated timestamp

### Monitoring Stock Module (`monitoring-stock.test.js`)
- ✅ GET `/monitoring-stock/chart` - Stock chart data
- ✅ GET `/monitoring-stock/province` - Province data
- ✅ GET `/monitoring-stock/regency` - Regency data
- ✅ GET `/monitoring-stock/entity` - Entity data
- ✅ GET `/monitoring-stock/entity-stock` - Entity stock details
- ✅ GET `/monitoring-stock/sismal` - SISMAL data
- ✅ GET `/monitoring-stock/material-entity` - Material entity mapping
- ✅ GET `/monitoring-stock/export` - CSV export

### Stock Book Module (`stock-book.test.js`)
- ✅ GET `/stock-book/export` - Single export
- ✅ GET `/stock-book/export-all` - Bulk export

### Reconciliation Module (`reconciliation.test.js`)
- ✅ GET `/reconciliation/summary-report` - Summary report
- ✅ GET `/reconciliation/entities-report` - Entities report
- ✅ GET `/reconciliation/entities-report/export` - Export entities report

### Performance Benchmarks (`performance.test.js`)
- ✅ Response time measurements
- ✅ Concurrent request handling
- ✅ Throughput capacity testing
- ✅ Latency metrics (P50, P95, P99)
- ✅ Load testing and burst patterns
- ✅ Resource usage monitoring

### Data Integrity (`data-integrity.test.js`)
- ✅ Response data structure validation
- ✅ Data type validation
- ✅ Cross-module consistency checks
- ✅ Error response structure validation
- ✅ Pagination data integrity
- ✅ Edge case handling

## Test Categories

### 1. Positive Test Cases
- Valid parameter combinations
- Successful response validation
- Data structure verification
- Pagination testing
- Filter and search functionality

### 2. Negative Test Cases
- Invalid request payloads
- Missing required parameters
- Malformed data inputs
- SQL injection attempts
- XSS prevention

### 3. Error Handling
- 400 Bad Request scenarios
- 401 Unauthorized access
- 403 Forbidden operations
- 404 Resource not found
- 422 Validation errors
- 500 Internal server errors

### 4. Performance Testing
- Response time benchmarks
- Concurrent user simulation
- Load testing scenarios
- Memory leak detection
- Throughput measurements

### 5. Security Testing
- Authentication validation
- Authorization checks
- Input sanitization
- Security header verification
- Token management

## Running the Tests

### Prerequisites
1. Ensure warehouse service is running
2. Configure environment variables in `.env`:
   ```
   AUTH_BASE_URL=http://localhost:8080
   WAREHOUSE_BASE_URL=http://localhost:8080
   AUTH_USERNAME=your_username
   AUTH_PASSWORD=your_password
   ```

### Run All Warehouse Tests
```bash
npm test -- test/api/warehouse/*.test.js
```

### Run Specific Test Suites
```bash
# Authentication tests
npm test -- test/api/warehouse/auth.test.js

# Module-specific tests
npm test -- test/api/warehouse/consumption-supply.test.js
npm test -- test/api/warehouse/monitoring-stock.test.js

# Performance tests
npm test -- test/api/warehouse/performance.test.js

# Data integrity tests
npm test -- test/api/warehouse/data-integrity.test.js
```

### Run with Coverage
```bash
npm run test:coverage -- test/api/warehouse/*.test.js
```

## Test Configuration

### Timeouts
- Standard tests: 15 seconds
- Export operations: 20-30 seconds
- Performance tests: 60 seconds

### Performance Thresholds
- Fast endpoints: < 2 seconds
- Medium endpoints: < 5 seconds
- Slow endpoints: < 10 seconds
- Export operations: < 30 seconds

### Concurrency Levels
- Light load: 3-5 concurrent requests
- Medium load: 5-10 concurrent requests
- Heavy load: 10-15 concurrent requests

## Test Data Requirements

### Required Test Data
- Valid program_id (default: 1)
- Valid province_id (default: 1)
- Valid regency_id (default: 1)
- Valid entity_id (default: 1)
- Valid material_id (default: 1)

### Date Ranges
- Default range: 2024-01-01 to 2024-12-31
- Performance tests: Limited to 1-3 months
- Edge case tests: Various invalid ranges

## Utilities and Helpers

### WarehouseTestUtils Class
- `request()` - Authenticated request helper
- `unauthenticatedRequest()` - Request without auth
- `invalidTokenRequest()` - Request with invalid token
- `validateResponse()` - Standard response validation
- `validatePaginationResponse()` - Pagination validation
- `validateErrorResponse()` - Error response validation
- `validateExcelResponse()` - Excel file validation
- `measureResponseTime()` - Performance measurement
- `runConcurrentRequests()` - Concurrency testing
- `getTestQueryParams()` - Default parameter generation

## Best Practices

### Test Organization
1. Group related tests in describe blocks
2. Use descriptive test names
3. Include both positive and negative cases
4. Test edge cases and boundary conditions
5. Validate response structure and data types

### Error Handling
1. Always validate error response structure
2. Check for appropriate HTTP status codes
3. Ensure error messages are user-friendly
4. Verify no sensitive data is exposed

### Performance Testing
1. Set realistic performance thresholds
2. Test under various load conditions
3. Monitor resource usage
4. Validate response times consistently

### Data Validation
1. Verify data types and formats
2. Check for data consistency
3. Validate business logic constraints
4. Test pagination accuracy

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify AUTH_BASE_URL is correct
   - Check username/password credentials
   - Ensure auth service is running

2. **Connection Timeouts**
   - Increase test timeouts if needed
   - Check warehouse service availability
   - Verify network connectivity

3. **Test Data Issues**
   - Ensure test database has required data
   - Verify entity/material IDs exist
   - Check date ranges are valid

4. **Performance Test Failures**
   - Adjust thresholds based on environment
   - Consider server load during testing
   - Check for resource constraints

### Debug Mode
Set environment variable for verbose logging:
```bash
DEBUG=warehouse-tests npm test
```

## Contributing

### Adding New Tests
1. Follow existing test patterns
2. Use WarehouseTestUtils for consistency
3. Include comprehensive error handling
4. Add performance validations
5. Update this README

### Test Maintenance
1. Update tests when APIs change
2. Adjust performance thresholds as needed
3. Keep test data requirements current
4. Review and update error scenarios

## Reporting

### Test Results
- All tests generate detailed console output
- Performance metrics are logged
- Error details are captured
- Coverage reports available with npm run test:coverage

### Continuous Integration
These tests are designed to run in CI/CD pipelines:
- Configurable timeouts
- Environment-specific settings
- Detailed failure reporting
- Performance regression detection

---

**Note**: This test suite provides comprehensive coverage of the warehouse service API. Regular execution helps ensure API reliability, performance, and data integrity across all supported operations.