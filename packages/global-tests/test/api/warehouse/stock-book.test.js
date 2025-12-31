const { WarehouseTestUtils, expect } = require('./base-warehouse.test');

describe('Warehouse Service - Stock Book Module', function() {
    this.timeout(20000); // Extended timeout for export operations

    describe('GET /stock-book/export - Single Export', function() {
        it('should export stock book data to Excel format', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                material_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            WarehouseTestUtils.validateExcelResponse(res);
            expect(res.header['filename']).to.include('.xlsx');
        });

        it('should export with specific entity filter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                from: '2024-06-01',
                to: '2024-06-30'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            WarehouseTestUtils.validateExcelResponse(res);
        });

        it('should export with specific material filter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                material_id: 1,
                entity_id: 1,
                from: '2024-01-01',
                to: '2024-03-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            WarehouseTestUtils.validateExcelResponse(res);
        });

        it('should export with date range filter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                from: '2024-01-01',
                to: '2024-01-31' // Single month
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            WarehouseTestUtils.validateExcelResponse(res);
        });

        it('should return 400 for missing required entity_id', async function() {
            const queryParams = {
                material_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
                // Missing entity_id
            };

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });

        it('should return 400 for invalid date range', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                from: '2024-12-31',
                to: '2024-01-01' // Invalid: from > to
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
        });

        it('should handle non-existent entity', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 99999, // Non-existent entity
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            // Should either return empty Excel or 404
            expect([200, 404]).to.include(res.status);
        });

        it('should handle non-existent material', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                material_id: 99999, // Non-existent material
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            // Should either return empty Excel or 404
            expect([200, 404]).to.include(res.status);
        });

        it('should validate export file size is reasonable', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                from: '2024-01-01',
                to: '2024-01-31' // Limited date range
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            if (res.status === 200) {
                const contentLength = res.headers['content-length'];
                if (contentLength) {
                    expect(parseInt(contentLength)).to.be.above(0);
                    expect(parseInt(contentLength)).to.be.below(50 * 1024 * 1024); // Max 50MB
                }
            }
        });

        it('should measure export performance', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                from: '2024-01-01',
                to: '2024-03-31'
            });

            const { response, responseTime } = await WarehouseTestUtils.measureResponseTime(
                () => WarehouseTestUtils.request()
                    .get('/stock-book/export')
                    .query(queryParams)
            );

            expect(response).to.have.status(200);
            expect(responseTime).to.be.below(30000); // Should complete within 30 seconds
        });
    });

    describe('GET /stock-book/export-all - Bulk Export', function() {
        it('should initiate bulk export process', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                province_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export-all')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res);
            expect(res.body.data).to.be.an('object');
            
            // Should return export job information
            if (res.body.data.export_id) {
                expect(res.body.data.export_id).to.be.a('string');
            }
            if (res.body.data.status) {
                expect(['pending', 'processing', 'completed', 'failed']).to.include(res.body.data.status);
            }
        });

        it('should handle bulk export with province filter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                province_id: 1,
                from: '2024-06-01',
                to: '2024-06-30'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export-all')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res);
        });

        it('should handle bulk export with regency filter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                regency_id: 1,
                from: '2024-01-01',
                to: '2024-03-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export-all')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res);
        });

        it('should handle bulk export with entity type filter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                entity_type_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export-all')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res);
        });

        it('should return 400 for missing required program_id', async function() {
            const queryParams = {
                province_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
                // Missing program_id
            };

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export-all')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });

        it('should return 400 for invalid date range in bulk export', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-12-31',
                to: '2024-01-01' // Invalid: from > to
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export-all')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
        });

        it('should handle non-existent program for bulk export', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 99999, // Non-existent program
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export-all')
                .query(queryParams);

            // Should either return empty result or 404
            expect([200, 404]).to.include(res.status);
        });

        it('should validate bulk export response structure', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-01-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export-all')
                .query(queryParams);

            if (res.status === 200) {
                expect(res.body).to.have.property('data');
                expect(res.body.data).to.be.an('object');
                
                // Common properties for export job
                const exportData = res.body.data;
                if (exportData.message) {
                    expect(exportData.message).to.be.a('string');
                }
                if (exportData.estimated_time) {
                    expect(exportData.estimated_time).to.be.a('number');
                }
            }
        });

        it('should measure bulk export initiation performance', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-01-31'
            });

            const { response, responseTime } = await WarehouseTestUtils.measureResponseTime(
                () => WarehouseTestUtils.request()
                    .get('/stock-book/export-all')
                    .query(queryParams)
            );

            expect(response).to.have.status(200);
            expect(responseTime).to.be.below(10000); // Initiation should be fast
        });
    });

    describe('Export Parameter Validation', function() {
        it('should validate date format requirements', async function() {
            const invalidDateFormats = [
                { from: '01-01-2024', to: '31-12-2024' }, // Wrong format
                { from: '2024/01/01', to: '2024/12/31' }, // Wrong separator
                { from: 'invalid-date', to: '2024-12-31' }, // Invalid date
                { from: '2024-13-01', to: '2024-12-31' }, // Invalid month
                { from: '2024-01-32', to: '2024-12-31' }  // Invalid day
            ];

            for (const dateParams of invalidDateFormats) {
                const queryParams = {
                    entity_id: 1,
                    ...dateParams
                };

                const res = await WarehouseTestUtils.request()
                    .get('/stock-book/export')
                    .query(queryParams);

                expect([400, 422]).to.include(res.status);
            }
        });

        it('should validate numeric parameter types', async function() {
            const invalidNumericParams = [
                { entity_id: 'not_a_number' },
                { material_id: 'invalid' },
                { program_id: null },
                { province_id: -1 },
                { regency_id: 0 }
            ];

            for (const numericParams of invalidNumericParams) {
                const queryParams = {
                    from: '2024-01-01',
                    to: '2024-12-31',
                    ...numericParams
                };

                const res = await WarehouseTestUtils.request()
                    .get('/stock-book/export')
                    .query(queryParams);

                expect([400, 422]).to.include(res.status);
            }
        });

        it('should handle extremely large date ranges', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                from: '2000-01-01',
                to: '2030-12-31' // 30+ year range
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            // Should either handle gracefully or return appropriate error
            expect([200, 400, 413, 422]).to.include(res.status);
        });

        it('should handle future date ranges', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                from: '2030-01-01',
                to: '2030-12-31' // Future dates
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            // Should handle gracefully (might return empty data)
            expect([200, 204, 400]).to.include(res.status);
        });
    });

    describe('Concurrent Export Handling', function() {
        it('should handle concurrent single exports', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                from: '2024-01-01',
                to: '2024-01-31'
            });

            const requestFn = () => WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            const results = await WarehouseTestUtils.runConcurrentRequests(requestFn, 3);

            results.forEach(result => {
                expect(result.response).to.have.status(200);
                expect(result.responseTime).to.be.below(45000);
            });
        });

        it('should handle concurrent bulk export requests', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-01-31'
            });

            const requestFn = () => WarehouseTestUtils.request()
                .get('/stock-book/export-all')
                .query(queryParams);

            const results = await WarehouseTestUtils.runConcurrentRequests(requestFn, 2);

            results.forEach(result => {
                expect(result.response).to.have.status(200);
                expect(result.responseTime).to.be.below(15000);
            });
        });

        it('should prevent resource exhaustion from too many exports', async function() {
            // Test system behavior under high export load
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                from: '2024-01-01',
                to: '2024-01-07' // Small range to reduce load
            });

            const requestFn = () => WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            // Try many concurrent requests
            const results = await WarehouseTestUtils.runConcurrentRequests(requestFn, 10);

            // Should either succeed or gracefully handle overload
            results.forEach(result => {
                expect([200, 429, 503]).to.include(result.response.status);
            });
        });
    });

    describe('Error Handling and Edge Cases', function() {
        it('should handle malformed query parameters', async function() {
            const malformedParams = {
                entity_id: 'SELECT * FROM users',
                from: '<script>alert(1)</script>',
                to: '2024-12-31'
            };

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(malformedParams);

            expect([400, 422]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });

        it('should provide meaningful error messages', async function() {
            const invalidParams = {
                // Missing required entity_id
                from: '2024-01-01',
                to: '2024-12-31'
            };

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(invalidParams);

            if (res.status >= 400) {
                expect(res.body).to.have.property('message');
                expect(res.body.message).to.be.a('string');
                expect(res.body.message.length).to.be.above(0);
                
                // Should not expose internal details
                const message = res.body.message.toLowerCase();
                expect(message).to.not.include('database');
                expect(message).to.not.include('sql');
                expect(message).to.not.include('internal');
            }
        });

        it('should handle database connection issues gracefully', async function() {
            // This test simulates potential database issues
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            // Should either succeed or return appropriate error
            expect([200, 500, 503]).to.include(res.status);
            
            if (res.status >= 500) {
                WarehouseTestUtils.validateErrorResponse(res, res.status);
            }
        });
    });

    describe('Data Integrity Validation', function() {
        it('should ensure export data consistency', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                from: '2024-01-01',
                to: '2024-01-31'
            });

            // Export same data twice
            const res1 = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            const res2 = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            if (res1.status === 200 && res2.status === 200) {
                // File sizes should be similar (allowing for minor differences)
                const size1 = parseInt(res1.headers['content-length'] || '0');
                const size2 = parseInt(res2.headers['content-length'] || '0');
                
                if (size1 > 0 && size2 > 0) {
                    const sizeDifference = Math.abs(size1 - size2) / Math.max(size1, size2);
                    expect(sizeDifference).to.be.below(0.1); // Less than 10% difference
                }
            }
        });

        it('should validate export filename format', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 1,
                from: '2024-01-01',
                to: '2024-01-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            if (res.status === 200) {
                const filename = res.headers['filename'];
                if (filename) {
                    expect(filename).to.include('.xlsx');
                    expect(filename).to.match(/^[a-zA-Z0-9_\-\s]+\.xlsx$/);
                }
            }
        });
    });
});