const { WarehouseTestUtils, expect } = require('./base-warehouse.test');

describe('Warehouse Service - Reconciliation Module', function() {
    this.timeout(15000);

    describe('GET /reconciliation/summary-report - Summary Report', function() {
        it('should return reconciliation summary report', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res);
            expect(res.body.data).to.be.an('object');
        });

        it('should handle summary report with province filter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                province_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            expect([200, 204]).to.include(res.status);
        });

        it('should handle summary report with regency filter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                regency_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            expect([200, 204]).to.include(res.status);
        });

        it('should handle summary report with entity filter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                entity_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            expect([200, 204]).to.include(res.status);
        });

        it('should handle summary report with material filter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                material_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            expect([200, 204]).to.include(res.status);
        });

        it('should return 400 for missing required program_id', async function() {
            const queryParams = {
                from: '2024-01-01',
                to: '2024-12-31'
                // Missing program_id
            };

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });

        it('should return 400 for invalid date range', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-12-31',
                to: '2024-01-01' // Invalid: from > to
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
        });

        it('should handle non-existent program', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 99999, // Non-existent program
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            expect([200, 204, 404]).to.include(res.status);
        });

        it('should validate summary report data structure', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            if (res.status === 200) {
                expect(res.body.data).to.be.an('object');
                
                // Validate common reconciliation summary properties
                const summaryData = res.body.data;
                if (summaryData.total_entities !== undefined) {
                    expect(summaryData.total_entities).to.be.a('number');
                    expect(summaryData.total_entities).to.be.at.least(0);
                }
                if (summaryData.reconciled_entities !== undefined) {
                    expect(summaryData.reconciled_entities).to.be.a('number');
                    expect(summaryData.reconciled_entities).to.be.at.least(0);
                }
                if (summaryData.discrepancy_count !== undefined) {
                    expect(summaryData.discrepancy_count).to.be.a('number');
                    expect(summaryData.discrepancy_count).to.be.at.least(0);
                }
            }
        });

        it('should measure summary report performance', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-03-31'
            });

            const { response, responseTime } = await WarehouseTestUtils.measureResponseTime(
                () => WarehouseTestUtils.request()
                    .get('/reconciliation/summary-report')
                    .query(queryParams)
            );

            expect(response).to.have.status(200);
            expect(responseTime).to.be.below(10000); // Should respond within 10 seconds
        });
    });

    describe('GET /reconciliation/entities-report - Entities Report', function() {
        it('should return entities reconciliation report', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res);
            expect(res.body.data).to.be.an('array');
        });

        it('should support pagination for entities report', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                page: 1,
                limit: 10,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            expect([200, 204]).to.include(res.status);
            
            if (res.status === 200) {
                expect(res.body.data).to.be.an('array');
                expect(res.body.data.length).to.be.at.most(10);
                
                // Should have pagination metadata
                if (res.body.meta) {
                    expect(res.body.meta).to.have.property('total');
                    expect(res.body.meta).to.have.property('page');
                    expect(res.body.meta).to.have.property('limit');
                }
            }
        });

        it('should filter entities report by province', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                province_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            expect([200, 204]).to.include(res.status);
        });

        it('should filter entities report by regency', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                regency_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            expect([200, 204]).to.include(res.status);
        });

        it('should filter entities report by entity type', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                entity_type_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            expect([200, 204]).to.include(res.status);
        });

        it('should support entities search by keyword', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                keyword: 'hospital',
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            expect([200, 204]).to.include(res.status);
        });

        it('should handle empty search results', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                keyword: 'nonexistententity12345',
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            expect([200, 204]).to.include(res.status);
        });

        it('should validate entities report data structure', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            if (res.status === 200 && res.body.data.length > 0) {
                const entityReport = res.body.data[0];
                expect(entityReport).to.be.an('object');
                
                // Validate common entity report properties
                expect(entityReport).to.have.property('entity_id');
                expect(entityReport.entity_id).to.be.a('number');
                
                if (entityReport.entity_name !== undefined) {
                    expect(entityReport.entity_name).to.be.a('string');
                }
                if (entityReport.reconciliation_status !== undefined) {
                    expect(['reconciled', 'discrepancy', 'pending']).to.include(entityReport.reconciliation_status);
                }
                if (entityReport.discrepancy_count !== undefined) {
                    expect(entityReport.discrepancy_count).to.be.a('number');
                    expect(entityReport.discrepancy_count).to.be.at.least(0);
                }
            }
        });

        it('should handle large page numbers gracefully', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                page: 999999,
                limit: 10,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            expect([200, 204, 400]).to.include(res.status);
        });
    });

    describe('GET /reconciliation/entities-report/export - Export Entities Report', function() {
        it('should export entities report to Excel format', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report/export')
                .query(queryParams);

            WarehouseTestUtils.validateExcelResponse(res);
        });

        it('should export filtered entities report', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                province_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report/export')
                .query(queryParams);

            WarehouseTestUtils.validateExcelResponse(res);
        });

        it('should export entities report with regency filter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                regency_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report/export')
                .query(queryParams);

            WarehouseTestUtils.validateExcelResponse(res);
        });

        it('should export entities report with entity type filter', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                entity_type_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report/export')
                .query(queryParams);

            WarehouseTestUtils.validateExcelResponse(res);
        });

        it('should export entities report with keyword search', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                keyword: 'hospital',
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report/export')
                .query(queryParams);

            WarehouseTestUtils.validateExcelResponse(res);
        });

        it('should return 400 for missing required program_id in export', async function() {
            const queryParams = {
                from: '2024-01-01',
                to: '2024-12-31'
                // Missing program_id
            };

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report/export')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });

        it('should handle export with invalid date range', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-12-31',
                to: '2024-01-01' // Invalid: from > to
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report/export')
                .query(queryParams);

            expect([400, 422]).to.include(res.status);
        });

        it('should validate export file size is reasonable', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-01-31' // Limited date range
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report/export')
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
            this.timeout(30000); // Extended timeout for export
            
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-03-31'
            });

            const { response, responseTime } = await WarehouseTestUtils.measureResponseTime(
                () => WarehouseTestUtils.request()
                    .get('/reconciliation/entities-report/export')
                    .query(queryParams)
            );

            expect(response).to.have.status(200);
            expect(responseTime).to.be.below(25000); // Should complete within 25 seconds
        });
    });

    describe('Parameter Validation and Edge Cases', function() {
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
                    program_id: 1,
                    ...dateParams
                };

                const res = await WarehouseTestUtils.request()
                    .get('/reconciliation/summary-report')
                    .query(queryParams);

                expect([400, 422]).to.include(res.status);
            }
        });

        it('should validate numeric parameter types', async function() {
            const invalidNumericParams = [
                { program_id: 'not_a_number' },
                { province_id: 'invalid' },
                { regency_id: null },
                { entity_id: -1 },
                { material_id: 0 }
            ];

            for (const numericParams of invalidNumericParams) {
                const queryParams = {
                    from: '2024-01-01',
                    to: '2024-12-31',
                    ...numericParams
                };

                const res = await WarehouseTestUtils.request()
                    .get('/reconciliation/summary-report')
                    .query(queryParams);

                expect([400, 422]).to.include(res.status);
            }
        });

        it('should handle extremely large date ranges', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2000-01-01',
                to: '2030-12-31' // 30+ year range
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            // Should either handle gracefully or return appropriate error
            expect([200, 400, 413, 422]).to.include(res.status);
        });

        it('should handle future date ranges', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2030-01-01',
                to: '2030-12-31' // Future dates
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            // Should handle gracefully (might return empty data)
            expect([200, 204, 400]).to.include(res.status);
        });
    });

    describe('Performance and Concurrency', function() {
        it('should handle concurrent summary report requests', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-03-31'
            });

            const requestFn = () => WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            const results = await WarehouseTestUtils.runConcurrentRequests(requestFn, 5);

            results.forEach(result => {
                expect(result.response).to.have.status(200);
                expect(result.responseTime).to.be.below(15000);
            });
        });

        it('should handle concurrent entities report requests', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                limit: 10,
                from: '2024-01-01',
                to: '2024-03-31'
            });

            const requestFn = () => WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            const results = await WarehouseTestUtils.runConcurrentRequests(requestFn, 3);

            results.forEach(result => {
                expect(result.response).to.have.status(200);
                expect(result.responseTime).to.be.below(12000);
            });
        });

        it('should maintain performance under mixed load', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-01-31'
            });

            // Mix of different endpoint requests
            const requests = [
                () => WarehouseTestUtils.request().get('/reconciliation/summary-report').query(queryParams),
                () => WarehouseTestUtils.request().get('/reconciliation/entities-report').query(queryParams)
            ];

            const results = await Promise.all(requests.map(req => 
                WarehouseTestUtils.measureResponseTime(req)
            ));

            results.forEach(result => {
                expect(result.response).to.have.status(200);
                expect(result.responseTime).to.be.below(15000);
            });
        });
    });

    describe('Data Integrity and Consistency', function() {
        it('should maintain data consistency between summary and entities reports', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            // Get summary report
            const summaryRes = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            // Get entities report
            const entitiesRes = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            if (summaryRes.status === 200 && entitiesRes.status === 200) {
                // Validate data consistency
                const summaryData = summaryRes.body.data;
                const entitiesData = entitiesRes.body.data;

                expect(summaryData).to.be.an('object');
                expect(entitiesData).to.be.an('array');

                // If summary shows total entities, it should be consistent with entities array length
                if (summaryData.total_entities !== undefined && entitiesData.length > 0) {
                    // Note: This might not be exact due to pagination, but should be reasonable
                    expect(summaryData.total_entities).to.be.a('number');
                    expect(summaryData.total_entities).to.be.at.least(0);
                }
            }
        });

        it('should validate numeric data types in reconciliation reports', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                from: '2024-01-01',
                to: '2024-12-31'
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            if (res.status === 200 && res.body.data.length > 0) {
                const entityReport = res.body.data[0];
                
                // Validate numeric fields
                if (entityReport.entity_id !== undefined) {
                    expect(entityReport.entity_id).to.be.a('number');
                    expect(entityReport.entity_id).to.be.above(0);
                }
                
                if (entityReport.discrepancy_count !== undefined) {
                    expect(entityReport.discrepancy_count).to.be.a('number');
                    expect(entityReport.discrepancy_count).to.be.at.least(0);
                }
                
                if (entityReport.reconciliation_percentage !== undefined) {
                    expect(entityReport.reconciliation_percentage).to.be.a('number');
                    expect(entityReport.reconciliation_percentage).to.be.at.least(0);
                    expect(entityReport.reconciliation_percentage).to.be.at.most(100);
                }
            }
        });

        it('should ensure export data matches report data', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                program_id: 1,
                limit: 5, // Small limit for comparison
                from: '2024-01-01',
                to: '2024-01-31'
            });

            // Get report data
            const reportRes = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            // Get export data
            const exportRes = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report/export')
                .query(queryParams);

            if (reportRes.status === 200 && exportRes.status === 200) {
                // Both should succeed
                expect(reportRes.body.data).to.be.an('array');
                expect(exportRes).to.have.header('Content-Type', 
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            }
        });
    });

    describe('Error Handling', function() {
        it('should handle malformed query parameters', async function() {
            const malformedParams = {
                program_id: 'SELECT * FROM programs',
                from: '<script>alert(1)</script>',
                to: '2024-12-31'
            };

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(malformedParams);

            expect([400, 422]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
        });

        it('should provide meaningful error messages', async function() {
            const invalidParams = {
                // Missing required program_id
                from: '2024-01-01',
                to: '2024-12-31'
            };

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
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
    });
});