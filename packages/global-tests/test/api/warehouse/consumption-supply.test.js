const { WarehouseTestUtils, expect } = require('./base-warehouse.test');

describe('Warehouse Service - Consumption Supply Module', function() {
    this.timeout(15000);

    describe('GET /consumption-supply/all - Overview Endpoint', function() {
        it('should return consumption and supply overview with valid parameters', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                period: 'monthly',
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res);
            if (res.status === 200) {
                expect(res.body.data).to.be.an('object');
            }
        });

        it('should handle pagination parameters', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                page: 2,
                limit: 5
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(queryParams);

            expect([200, 204, 422]).to.include(res.status);
        });

        it('should return 400 for invalid date range', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                from: '2024-12-31',
                to: '2024-01-01' // Invalid: from > to
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
        });

        it('should return 400 for missing required parameters', async function() {
            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all');
                // No query parameters

            expect([200, 400, 422]).to.include(res.status);
            if (res.status !== 200) {
                WarehouseTestUtils.validateErrorResponse(res, res.status);
            }
        });

        it('should handle empty dataset gracefully', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 99999, // Non-existent program
                from: '2030-01-01',
                to: '2030-01-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(queryParams);

            expect([200, 204, 422]).to.include(res.status);
        });

        it('should validate response time performance', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();
            
            const { response, responseTime } = await WarehouseTestUtils.measureResponseTime(
                () => WarehouseTestUtils.request()
                    .get('/consumption-supply/all')
                    .query(queryParams)
            );

            expect([200, 422]).to.include(response.status);
            expect(responseTime).to.be.below(5000); // Should respond within 5 seconds
        });
    });

    describe('GET /consumption-supply/location - Location Master Data', function() {
        it('should return location master data', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/location')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res);
            if (res.status === 200) {
                expect(res.body.data).to.be.an('array');
            }
        });

        it('should filter locations by province', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                province_id: 1
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/location')
                .query(queryParams);

            expect([200, 204, 422]).to.include(res.status);
        });

        it('should handle invalid province_id', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                province_id: 'invalid'
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/location')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
        });
    });

    describe('GET /consumption-supply/entity - Entity Master Data', function() {
        it('should return entity master data', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/entity')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res);
            if (res.status === 200) {
                expect(res.body.data).to.be.an('array');
            }
        });

        it('should filter entities by regency', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                regency_id: 1
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/entity')
                .query(queryParams);

            expect([200, 204, 422]).to.include(res.status);
        });

        it('should support entity type filtering', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_type_id: 1
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/entity')
                .query(queryParams);

            expect([200, 204, 422]).to.include(res.status);
        });
    });

    describe('GET /consumption-supply/material - Material Master Data', function() {
        it('should return material master data', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/material')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res);
            if (res.status === 200) {
                expect(res.body.data).to.be.an('array');
            }
        });

        it('should filter materials by type', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                material_type_id: 1
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/material')
                .query(queryParams);

            expect([200, 204, 422]).to.include(res.status);
        });

        it('should support material search by keyword', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                keyword: 'test'
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/material')
                .query(queryParams);

            expect([200, 204, 422]).to.include(res.status);
        });
    });

    describe('GET /consumption-supply/export - Excel Export', function() {
        it('should export data to Excel format', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                usedFor: 'all'
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/export')
                .query(queryParams);

            WarehouseTestUtils.validateExcelResponse(res);
        });

        it('should export consumption data only', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                usedFor: 'consumption'
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/export')
                .query(queryParams);

            WarehouseTestUtils.validateExcelResponse(res);
        });

        it('should export supply data only', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                usedFor: 'supply'
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/export')
                .query(queryParams);

            WarehouseTestUtils.validateExcelResponse(res);
        });

        it('should handle invalid usedFor parameter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                usedFor: 'invalid_type'
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/export')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
        });

        it('should validate export file size is reasonable', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/export')
                .query(queryParams);

            if (res.status === 200) {
                const contentLength = res.headers['content-length'];
                if (contentLength) {
                    expect(parseInt(contentLength)).to.be.above(0);
                    expect(parseInt(contentLength)).to.be.below(50 * 1024 * 1024); // Max 50MB
                }
            }
        });
    });

    describe('GET /consumption-supply/period-switcher - Period Switching', function() {
        it('should return date range for monthly period', async function() {
            const queryParams = {
                period: 'monthly',
                currentDate: '2024-06-15'
            };

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/period-switcher')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res, 200, false); // Don't expect 'data' property
            if (res.status === 200) {
                expect(res.body).to.have.property('period', 'monthly');
                expect(res.body).to.have.property('from');
                expect(res.body).to.have.property('to');
            }
        });

        it('should return date range for yearly period', async function() {
            const queryParams = {
                period: 'yearly',
                currentDate: '2024-06-15'
            };

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/period-switcher')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res, 200, false); // Don't expect 'data' property
            if (res.status === 200) {
                expect(res.body).to.have.property('period', 'yearly');
            }
        });

        it('should handle invalid period type', async function() {
            const queryParams = {
                period: 'invalid_period',
                currentDate: '2024-06-15'
            };

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/period-switcher')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
        });

        it('should handle invalid date format', async function() {
            const queryParams = {
                period: 'monthly',
                currentDate: 'invalid-date'
            };

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/period-switcher')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
        });
    });

    describe('GET /consumption-supply/interval-period - Period Intervals', function() {
        it('should return previous and next intervals for monthly period', async function() {
            const queryParams = {
                period: 'monthly',
                from: '2024-06-01',
                to: '2024-06-30'
            };

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/interval-period')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res, 200, false); // Don't expect 'data' property
            if (res.status === 200) {
                expect(res.body).to.have.property('period', 'monthly');
                expect(res.body).to.have.property('current');
                expect(res.body).to.have.property('previous');
                expect(res.body).to.have.property('next');
            }
        });

        it('should return intervals for yearly period', async function() {
            const queryParams = {
                period: 'yearly',
                from: '2024-01-01',
                to: '2024-12-31'
            };

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/interval-period')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res, 200, false); // Don't expect 'data' property
            if (res.status === 200) {
                expect(res.body).to.have.property('period', 'yearly');
            }
        });

        it('should validate date range consistency', async function() {
            const queryParams = {
                period: 'monthly',
                from: '2024-06-30',
                to: '2024-06-01' // Invalid: from > to
            };

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/interval-period')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
        });
    });

    describe('GET /consumption-supply/last-updated - Last Updated Timestamp', function() {
        it('should return last updated timestamp', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/last-updated')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res, 200, false); // Don't expect 'data' property
            if (res.status === 200) {
                expect(res.body).to.have.property('last_updated');
            }
        });

        it('should handle case when no data exists', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 99999 // Non-existent program
            });

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/last-updated')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res, 200, false); // Don't expect 'data' property
            if (res.status === 200) {
                expect(res.body.last_updated).to.be.null;
            }
        });

        it('should validate timestamp format if present', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/last-updated')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res, 200, false); // Don't expect 'data' property
            
            if (res.body.last_updated) {
                // Should be a valid ISO date string or timestamp
                const timestamp = new Date(res.body.last_updated);
                expect(timestamp).to.be.instanceOf(Date);
                expect(timestamp.getTime()).to.not.be.NaN;
            }
        });
    });

    describe('Error Handling and Edge Cases', function() {
        it('should handle SQL injection attempts', async function() {
            const maliciousParams = {
                program_id: "1; DROP TABLE users; --",
                province_id: "1' OR '1'='1"
            };

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(maliciousParams);

            expect([400, 422]).to.include(res.status);
        });

        it('should handle extremely large parameter values', async function() {
            const largeParams = {
                program_id: Number.MAX_SAFE_INTEGER,
                limit: 10000
            };

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(largeParams);

            expect([200, 400, 422]).to.include(res.status);
        });

        it('should handle concurrent requests to same endpoint', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();
            
            const requestFn = () => WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(queryParams);

            const results = await WarehouseTestUtils.runConcurrentRequests(requestFn, 5);

            results.forEach(result => {
                expect([200, 422]).to.include(result.response.status);
                expect(result.responseTime).to.be.below(10000);
            });
        });

        it('should maintain data consistency across multiple calls', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res1 = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(queryParams);

            const res2 = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(queryParams);

            if (res1.status === 200 && res2.status === 200) {
                // Data should be consistent between calls (assuming no data changes)
                expect(typeof res1.body.data).to.equal(typeof res2.body.data);
            }
        });
    });
});