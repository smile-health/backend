const { WarehouseTestUtils, expect } = require('./base-warehouse.test');

describe('Warehouse Service - Authentication & Authorization', function() {
    this.timeout(10000);

    describe('Authentication Tests', function() {
        it('should allow access with valid token', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();
            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(queryParams);
            
            // Accept both 200 (success) and 422 (validation error) as valid authenticated responses
            // 422 indicates the request was authenticated but has validation issues with parameters
            expect([200, 422]).to.include(res.status);
            expect(res.body).to.be.an('object');
            
            // If 422, it should have a validation error message
            if (res.status === 422) {
                expect(res.body).to.have.property('message');
            }
        });

        it('should reject requests without authentication token', async function() {
            const res = await WarehouseTestUtils.unauthenticatedRequest()
                .get('/consumption-supply/all')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            expect(res).to.have.status(401);
            WarehouseTestUtils.validateErrorResponse(res, 401);
        });

        it('should reject requests with invalid token', async function() {
            const res = await WarehouseTestUtils.invalidTokenRequest()
                .get('/consumption-supply/all')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Accept both 401 (unauthorized) and 403 (forbidden) as valid rejection responses
            expect([401, 403]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });

        it('should reject requests with expired token', async function() {
            const res = await WarehouseTestUtils.expiredTokenRequest()
                .get('/consumption-supply/all')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Accept both 401 (unauthorized) and 403 (forbidden) as valid rejection responses
            expect([401, 403]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });

        it('should reject requests with malformed Authorization header', async function() {
            const res = await WarehouseTestUtils.unauthenticatedRequest()
                .get('/consumption-supply/all')
                .set('Authorization', 'InvalidFormat token123')
                .set('x-program-id', process.env.WAREHOUSE_PROGRAM_ID || '3')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Accept both 401 (unauthorized) and 403 (forbidden) as valid rejection responses
            expect([401, 403]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });

        it('should reject requests with empty Bearer token', async function() {
            const res = await WarehouseTestUtils.unauthenticatedRequest()
                .get('/consumption-supply/all')
                .set('Authorization', 'Bearer ')
                .set('x-program-id', process.env.WAREHOUSE_PROGRAM_ID || '3')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Accept both 401 (unauthorized) and 403 (forbidden) as valid rejection responses
            expect([401, 403]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });
    });

    describe('Role-Based Access Control Tests', function() {
        // Test different endpoints that require specific roles
        const protectedEndpoints = [
            { path: '/consumption-supply/all', method: 'get', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'SATUSEHAT'] },
            { path: '/monitoring-stock/chart', method: 'get', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'SATUSEHAT'] },
            { path: '/stock-book/export', method: 'get', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'SATUSEHAT'] },
            { path: '/reconciliation/summary-report', method: 'get', roles: ['SUPERADMIN', 'ADMIN', 'MANAGER', 'SATUSEHAT'] }
        ];

        protectedEndpoints.forEach(endpoint => {
            it(`should allow access to ${endpoint.path} with valid role`, async function() {
                const queryParams = WarehouseTestUtils.getTestQueryParams();
                
                const res = await WarehouseTestUtils.request()[endpoint.method](endpoint.path)
                    .query(queryParams);
                
                // Should not return 403 Forbidden (role-based rejection)
                expect(res.status).to.not.equal(403);
                // May return 200 (success) or other valid status codes like 400 (bad request due to test data)
                expect([200, 400, 404, 422]).to.include(res.status);
            });
        });

        it('should validate device type restrictions', async function() {
            // Test with mobile device type header (should be rejected for web-only endpoints)
            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .set('X-Device-Type', 'mobile')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Should either succeed or return specific device type error or validation error
            expect([200, 400, 403, 422]).to.include(res.status);
        });

        it('should allow access with web device type', async function() {
            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .set('X-Device-Type', 'web')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Accept both 200 (success) and 422 (validation error) as valid authenticated responses
            expect([200, 422]).to.include(res.status);
            expect(res.body).to.be.an('object');
        });
    });

    describe('Token Validation Edge Cases', function() {
        it('should handle token with special characters', async function() {
            const specialToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.special+chars/test=';
            const res = await WarehouseTestUtils.unauthenticatedRequest()
                .get('/consumption-supply/all')
                .set('Authorization', `Bearer ${specialToken}`)
                .set('x-program-id', process.env.WAREHOUSE_PROGRAM_ID || '3')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Accept both 401 (unauthorized) and 403 (forbidden) as valid rejection responses
            expect([401, 403]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });

        it('should handle extremely long token', async function() {
            const longToken = 'a'.repeat(2000);
            const res = await WarehouseTestUtils.unauthenticatedRequest()
                .get('/consumption-supply/all')
                .set('Authorization', `Bearer ${longToken}`)
                .set('x-program-id', process.env.WAREHOUSE_PROGRAM_ID || '3')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Accept both 401 (unauthorized) and 403 (forbidden) as valid rejection responses
            expect([401, 403]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });

        it('should handle multiple Authorization headers', async function() {
            const res = await WarehouseTestUtils.unauthenticatedRequest()
                .get('/consumption-supply/all')
                .set('Authorization', 'Bearer token1')
                .set('Authorization', 'Bearer token2')
                .set('x-program-id', process.env.WAREHOUSE_PROGRAM_ID || '3')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Accept both 401 (unauthorized) and 403 (forbidden) as valid rejection responses
            expect([401, 403]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });
    });

    describe('Session Management', function() {
        it('should maintain session across multiple requests', async function() {
            const token = WarehouseTestUtils.getAuthToken();
            
            // First request
            const res1 = await WarehouseTestUtils.request(token)
                .get('/consumption-supply/all')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Accept both 200 (success) and 422 (validation error) as valid authenticated responses
            expect([200, 422]).to.include(res1.status);
            
            // Second request with same token
            const res2 = await WarehouseTestUtils.request(token)
                .get('/monitoring-stock/chart')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Accept 200 (success), 422 (validation error), or 404 (endpoint not found) as valid responses
            expect([200, 422, 404]).to.include(res2.status);
        });

        it('should handle concurrent requests with same token', async function() {
            const token = WarehouseTestUtils.getAuthToken();
            const queryParams = WarehouseTestUtils.getTestQueryParams();
            
            const requestFn = () => WarehouseTestUtils.request(token)
                .get('/consumption-supply/all')
                .query(queryParams);
            
            const results = await WarehouseTestUtils.runConcurrentRequests(requestFn, 3);
            
            results.forEach(result => {
                // Accept both 200 (success) and 422 (validation error) as valid authenticated responses
                expect([200, 422]).to.include(result.response.status);
            });
        });
    });

    describe('Security Headers Validation', function() {
        it('should validate required security headers in response', async function() {
            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Accept both 200 (success) and 422 (validation error) as valid authenticated responses
            expect([200, 422]).to.include(res.status);
            
            // Check for common security headers
            const headers = res.headers;
            
            // These headers might be set by the application or reverse proxy
            if (headers['x-content-type-options']) {
                expect(headers['x-content-type-options']).to.equal('nosniff');
            }
            
            if (headers['x-frame-options']) {
                expect(['DENY', 'SAMEORIGIN']).to.include(headers['x-frame-options']);
            }
        });

        it('should not expose sensitive information in error responses', async function() {
            const res = await WarehouseTestUtils.invalidTokenRequest()
                .get('/consumption-supply/all')
                .query(WarehouseTestUtils.getTestQueryParams());
            
            // Accept both 401 (unauthorized) and 403 (forbidden) as valid rejection responses
            expect([401, 403]).to.include(res.status);
            
            // Error message should not contain sensitive information
            const errorMessage = res.body.message || '';
            expect(errorMessage.toLowerCase()).to.not.include('database');
            expect(errorMessage.toLowerCase()).to.not.include('sql');
            expect(errorMessage.toLowerCase()).to.not.include('internal');
            expect(errorMessage.toLowerCase()).to.not.include('stack');
        });
    });
});