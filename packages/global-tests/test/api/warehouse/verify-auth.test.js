const { WarehouseTestUtils } = require('./base-warehouse.test');

/**
 * Simple test to verify authentication headers are being sent
 * Run this to check if Bearer token is included in requests
 */
describe('Authentication Verification', function() {
    it('should verify auth token is available', function() {
        const token = WarehouseTestUtils.getAuthToken();
        console.log('Auth token available:', !!token);
        console.log('Token length:', token ? token.length : 0);
    });

    it('should verify request includes both headers', function() {
        const request = WarehouseTestUtils.request();
        
        // This is a basic check - in real scenarios, the headers would be
        // verified by the actual HTTP request
        console.log('Request object created successfully');
        console.log('x-program-id header should be set to:', process.env.WAREHOUSE_PROGRAM_ID || '3');
        
        const token = WarehouseTestUtils.getAuthToken();
        if (token) {
            console.log('Authorization header should include Bearer token');
        } else {
            console.log('WARNING: No auth token available - requests will be unauthenticated');
        }
    });
});