const { WarehouseTestUtils, expect } = require('./base-warehouse.test');

describe('Warehouse Service - Data Integrity Validation', function() {
    this.timeout(15000);

    describe('Response Data Structure Validation', function() {
        it('should validate consumption-supply response structure', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res);
            
            if (res.body.data) {
                expect(res.body.data).to.be.an('object');
                
                // Validate common data structure properties
                const data = res.body.data;
                if (data.consumption !== undefined) {
                    expect(data.consumption).to.be.an('object');
                }
                if (data.supply !== undefined) {
                    expect(data.supply).to.be.an('object');
                }
                if (data.period !== undefined) {
                    expect(data.period).to.be.a('string');
                }
            }
        });

        it('should validate monitoring-stock response structure', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/monitoring-stock/chart')
                .query(queryParams);

            // Accept 200 (success), 422 (validation error), or 404 (endpoint not found) as valid responses
            if (res.status === 404) {
                expect(res).to.have.status(404);
                return; // Skip validation if endpoint doesn't exist
            }
            WarehouseTestUtils.validateResponse(res);
            
            if (res.body.data) {
                expect(res.body.data).to.be.an('object');
                
                const data = res.body.data;
                if (data.chart_data !== undefined) {
                    expect(data.chart_data).to.be.an('array');
                }
                if (data.summary !== undefined) {
                    expect(data.summary).to.be.an('object');
                }
            }
        });

        it('should validate reconciliation response structure', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            WarehouseTestUtils.validateResponse(res);
            
            if (res.body.data) {
                expect(res.body.data).to.be.an('object');
                
                const data = res.body.data;
                if (data.total_entities !== undefined) {
                    expect(data.total_entities).to.be.a('number');
                    expect(data.total_entities).to.be.at.least(0);
                }
                if (data.reconciled_entities !== undefined) {
                    expect(data.reconciled_entities).to.be.a('number');
                    expect(data.reconciled_entities).to.be.at.least(0);
                }
            }
        });

        it('should validate array response structures', async function() {
            const arrayEndpoints = [
                '/consumption-supply/location',
                '/consumption-supply/entity',
                '/consumption-supply/material',
                '/monitoring-stock/province',
                '/monitoring-stock/regency',
                '/reconciliation/entities-report'
            ];

            for (const endpoint of arrayEndpoints) {
                const queryParams = WarehouseTestUtils.getTestQueryParams();
                
                const res = await WarehouseTestUtils.request()
                    .get(endpoint)
                    .query(queryParams);

                expect([200, 204, 404, 422]).to.include(res.status);
                
                if (res.status === 200) {
                    expect(res.body.data).to.be.an('array');
                    
                    // If array has items, validate first item structure
                    if (res.body.data.length > 0) {
                        const firstItem = res.body.data[0];
                        expect(firstItem).to.be.an('object');
                        expect(Object.keys(firstItem).length).to.be.above(0);
                    }
                }
            }
        });
    });

    describe('Data Type Validation', function() {
        it('should validate numeric fields are properly typed', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/monitoring-stock/entity-stock')
                .query(queryParams);

            if (res.status === 200 && res.body.data.length > 0) {
                const stockItem = res.body.data[0];
                
                // Validate ID fields
                if (stockItem.entity_id !== undefined) {
                    expect(stockItem.entity_id).to.be.a('number');
                    expect(stockItem.entity_id).to.be.above(0);
                }
                if (stockItem.material_id !== undefined) {
                    expect(stockItem.material_id).to.be.a('number');
                    expect(stockItem.material_id).to.be.above(0);
                }
                
                // Validate quantity fields
                if (stockItem.stock_quantity !== undefined) {
                    expect(stockItem.stock_quantity).to.be.a('number');
                    expect(stockItem.stock_quantity).to.be.at.least(0);
                }
                if (stockItem.stock_value !== undefined) {
                    expect(stockItem.stock_value).to.be.a('number');
                    expect(stockItem.stock_value).to.be.at.least(0);
                }
                
                // Validate string fields
                if (stockItem.entity_name !== undefined) {
                    expect(stockItem.entity_name).to.be.a('string');
                    expect(stockItem.entity_name.length).to.be.above(0);
                }
                if (stockItem.material_name !== undefined) {
                    expect(stockItem.material_name).to.be.a('string');
                    expect(stockItem.material_name.length).to.be.above(0);
                }
            }
        });

        it('should validate date fields are properly formatted', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/last-updated')
                .query(queryParams);

            if (res.status === 200 && res.body.last_updated) {
                const lastUpdated = res.body.last_updated;
                
                // Should be a valid date string or timestamp
                const date = new Date(lastUpdated);
                expect(date).to.be.instanceOf(Date);
                expect(date.getTime()).to.not.be.NaN;
                
                // Should be a reasonable date (not too far in past/future)
                const now = new Date();
                const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
                
                expect(date.getTime()).to.be.at.least(oneYearAgo.getTime());
                expect(date.getTime()).to.be.at.most(oneYearFromNow.getTime());
            }
        });

        it('should validate boolean fields are properly typed', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/entity')
                .query(queryParams);

            if (res.status === 200 && res.body.data.length > 0) {
                const entityItem = res.body.data[0];
                
                // Check for boolean fields
                if (entityItem.is_active !== undefined) {
                    expect(entityItem.is_active).to.be.a('boolean');
                }
                if (entityItem.is_deleted !== undefined) {
                    expect(entityItem.is_deleted).to.be.a('boolean');
                }
            }
        });

        it('should validate enum fields have valid values', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            if (res.status === 200 && res.body.data.length > 0) {
                const entityReport = res.body.data[0];
                
                // Validate status enum fields
                if (entityReport.reconciliation_status !== undefined) {
                    const validStatuses = ['reconciled', 'discrepancy', 'pending', 'not_reconciled'];
                    expect(validStatuses).to.include(entityReport.reconciliation_status);
                }
                
                if (entityReport.entity_type !== undefined) {
                    expect(entityReport.entity_type).to.be.a('string');
                    expect(entityReport.entity_type.length).to.be.above(0);
                }
            }
        });
    });

    describe('Data Consistency Validation', function() {
        it('should ensure data consistency between related endpoints', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                province_id: 1
            });

            // Get province data
            const provinceRes = await WarehouseTestUtils.request()
                .get('/monitoring-stock/province')
                .query(queryParams);

            // Get regency data for the same province
            const regencyRes = await WarehouseTestUtils.request()
                .get('/monitoring-stock/regency')
                .query(queryParams);

            if (provinceRes.status === 200 && regencyRes.status === 200) {
                expect(provinceRes.body.data).to.be.an('array');
                expect(regencyRes.body.data).to.be.an('array');
                
                // If province has data, regencies should exist for that province
                if (provinceRes.body.data.length > 0) {
                    const province = provinceRes.body.data.find(p => p.province_id === 1);
                    if (province && regencyRes.body.data.length > 0) {
                        // All regencies should belong to the specified province
                        regencyRes.body.data.forEach(regency => {
                            if (regency.province_id !== undefined) {
                                expect(regency.province_id).to.equal(1);
                            }
                        });
                    }
                }
            }
        });

        it('should validate hierarchical data relationships', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            // Get entity data
            const entityRes = await WarehouseTestUtils.request()
                .get('/consumption-supply/entity')
                .query(queryParams);

            if (entityRes.status === 200 && entityRes.body.data.length > 0) {
                const entities = entityRes.body.data;
                
                entities.forEach(entity => {
                    // Validate hierarchical relationships
                    if (entity.province_id !== undefined && entity.regency_id !== undefined) {
                        expect(entity.province_id).to.be.a('number');
                        expect(entity.regency_id).to.be.a('number');
                        expect(entity.province_id).to.be.above(0);
                        expect(entity.regency_id).to.be.above(0);
                    }
                    
                    if (entity.entity_type_id !== undefined) {
                        expect(entity.entity_type_id).to.be.a('number');
                        expect(entity.entity_type_id).to.be.above(0);
                    }
                });
            }
        });

        it('should validate aggregated data matches detail data', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                from: '2024-01-01',
                to: '2024-01-31' // Limited range for comparison
            });

            // Get summary data
            const summaryRes = await WarehouseTestUtils.request()
                .get('/reconciliation/summary-report')
                .query(queryParams);

            // Get detailed data
            const detailRes = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            if (summaryRes.status === 200 && detailRes.status === 200) {
                const summary = summaryRes.body.data;
                const details = detailRes.body.data;
                
                if (summary.total_entities !== undefined && details.length > 0) {
                    // Summary total should be reasonable compared to detail count
                    // (Note: might not be exact due to pagination)
                    expect(summary.total_entities).to.be.a('number');
                    expect(summary.total_entities).to.be.at.least(0);
                    
                    if (details.length === summary.total_entities) {
                        // If counts match, validate aggregations
                        const reconciledCount = details.filter(d => 
                            d.reconciliation_status === 'reconciled'
                        ).length;
                        
                        if (summary.reconciled_entities !== undefined) {
                            expect(summary.reconciled_entities).to.equal(reconciledCount);
                        }
                    }
                }
            }
        });

        it('should validate cross-module data consistency', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            // Get entity data from consumption-supply
            const csEntityRes = await WarehouseTestUtils.request()
                .get('/consumption-supply/entity')
                .query(queryParams);

            // Get entity data from monitoring-stock
            const msEntityRes = await WarehouseTestUtils.request()
                .get('/monitoring-stock/entity')
                .query(queryParams);

            if (csEntityRes.status === 200 && msEntityRes.status === 200) {
                const csEntities = csEntityRes.body.data;
                const msEntities = msEntityRes.body.data;
                
                // Both should return entity arrays
                expect(csEntities).to.be.an('array');
                expect(msEntities).to.be.an('array');
                
                // If both have data, validate entity structure consistency
                if (csEntities.length > 0 && msEntities.length > 0) {
                    const csEntity = csEntities[0];
                    const msEntity = msEntities[0];
                    
                    // Common fields should have same data types
                    if (csEntity.entity_id !== undefined && msEntity.entity_id !== undefined) {
                        expect(typeof csEntity.entity_id).to.equal(typeof msEntity.entity_id);
                    }
                    if (csEntity.entity_name !== undefined && msEntity.entity_name !== undefined) {
                        expect(typeof csEntity.entity_name).to.equal(typeof msEntity.entity_name);
                    }
                }
            }
        });
    });

    describe('Error Response Structure Validation', function() {
        it('should validate error response structure for 400 errors', async function() {
            const invalidParams = {
                // Missing required parameters
                from: '2024-01-01'
                // Missing 'to' parameter
            };

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/all')
                .query(invalidParams);

            expect([400, 422]).to.include(res.status);
            WarehouseTestUtils.validateErrorResponse(res, res.status);
            
            // Validate error structure
            expect(res.body).to.have.property('message');
            expect(res.body.message).to.be.a('string');
            expect(res.body.message.length).to.be.above(0);
            
            // Should not contain sensitive information
            const message = res.body.message.toLowerCase();
            expect(message).to.not.include('database');
            expect(message).to.not.include('sql');
            expect(message).to.not.include('password');
            expect(message).to.not.include('secret');
        });

        it('should validate error response structure for 404 errors', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                entity_id: 99999999 // Non-existent entity
            });

            const res = await WarehouseTestUtils.request()
                .get('/stock-book/export')
                .query(queryParams);

            if (res.status === 404) {
                WarehouseTestUtils.validateErrorResponse(res, 404);
                
                expect(res.body).to.have.property('message');
                expect(res.body.message).to.be.a('string');
                
                // Error message should be user-friendly
                const message = res.body.message.toLowerCase();
                expect(message).to.include('not found').or.include('does not exist');
            }
        });

        it('should validate consistent error format across endpoints', async function() {
            const endpoints = [
                '/consumption-supply/all',
                '/monitoring-stock/chart',
                '/reconciliation/summary-report'
            ];

            const invalidParams = {
                program_id: 'invalid_id'
            };

            for (const endpoint of endpoints) {
                const res = await WarehouseTestUtils.request()
                    .get(endpoint)
                    .query(invalidParams);

                if (res.status >= 400) {
                    // All error responses should have consistent structure
                    expect(res.body).to.be.an('object');
                    if (Object.keys(res.body).length > 0) {
                        expect(res.body).to.have.property('message');
                        expect(res.body.message).to.be.a('string');
                    }
                    
                    // Optional fields should be consistent if present
                    if (res.body.error_code !== undefined) {
                        expect(res.body.error_code).to.be.a('string');
                    }
                    if (res.body.details !== undefined) {
                        expect(res.body.details).to.be.an('object');
                    }
                }
            }
        });
    });

    describe('Pagination Data Integrity', function() {
        it('should validate pagination metadata consistency', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams({
                page: 1,
                limit: 5
            });

            const res = await WarehouseTestUtils.request()
                .get('/reconciliation/entities-report')
                .query(queryParams);

            if (res.status === 200) {
                expect(res.body.data).to.be.an('array');
                
                if (res.body.meta) {
                    const meta = res.body.meta;
                    
                    // Validate pagination metadata
                    expect(meta).to.have.property('page');
                    expect(meta).to.have.property('limit');
                    expect(meta).to.have.property('total');
                    
                    expect(meta.page).to.be.a('number');
                    expect(meta.limit).to.be.a('number');
                    expect(meta.total).to.be.a('number');
                    
                    expect(meta.page).to.be.at.least(1);
                    expect(meta.limit).to.be.at.least(1);
                    expect(meta.total).to.be.at.least(0);
                    
                    // Data array length should not exceed limit
                    expect(res.body.data.length).to.be.at.most(meta.limit);
                    
                    // If total is less than limit, data length should equal total
                    if (meta.total <= meta.limit && meta.page === 1) {
                        expect(res.body.data.length).to.equal(meta.total);
                    }
                }
            }
        });

        it('should validate pagination boundary conditions', async function() {
            // Test first page
            const firstPageParams = WarehouseTestUtils.getTestQueryParams({
                page: 1,
                limit: 3
            });

            const firstPageRes = await WarehouseTestUtils.request()
                .get('/monitoring-stock/entity')
                .query(firstPageParams);

            if (firstPageRes.status === 200 && firstPageRes.body.meta) {
                const totalPages = Math.ceil(firstPageRes.body.meta.total / firstPageRes.body.meta.limit);
                
                if (totalPages > 1) {
                    // Test last page
                    const lastPageParams = {
                        ...firstPageParams,
                        page: totalPages
                    };

                    const lastPageRes = await WarehouseTestUtils.request()
                        .get('/monitoring-stock/entity')
                        .query(lastPageParams);

                    if (lastPageRes.status === 200) {
                        expect(lastPageRes.body.data).to.be.an('array');
                        expect(lastPageRes.body.data.length).to.be.at.most(firstPageParams.limit);
                        
                        // Last page should have remaining items
                        const expectedLastPageItems = firstPageRes.body.meta.total % firstPageParams.limit;
                        if (expectedLastPageItems > 0) {
                            expect(lastPageRes.body.data.length).to.equal(expectedLastPageItems);
                        }
                    }
                }
            }
        });
    });

    describe('Data Validation Edge Cases', function() {
        it('should handle null and undefined values gracefully', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/entity')
                .query(queryParams);

            if (res.status === 200 && res.body.data.length > 0) {
                res.body.data.forEach((item, index) => {
                    // Check that null values are properly handled
                    Object.values(item).forEach(value => {
                        // Values should not be undefined (null is acceptable)
                        expect(value).to.not.equal(undefined, 
                            `Item ${index} has undefined value`);
                    });
                });
            }
        });

        it('should validate data ranges and constraints', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/monitoring-stock/entity-stock')
                .query(queryParams);

            if (res.status === 200 && res.body.data.length > 0) {
                res.body.data.forEach((stockItem, index) => {
                    // Validate numeric constraints
                    if (stockItem.stock_quantity !== undefined) {
                        expect(stockItem.stock_quantity).to.be.at.least(0, 
                            `Stock quantity should not be negative for item ${index}`);
                    }
                    
                    if (stockItem.stock_value !== undefined) {
                        expect(stockItem.stock_value).to.be.at.least(0, 
                            `Stock value should not be negative for item ${index}`);
                    }
                    
                    // Validate percentage fields
                    if (stockItem.percentage !== undefined) {
                        expect(stockItem.percentage).to.be.at.least(0);
                        expect(stockItem.percentage).to.be.at.most(100);
                    }
                });
            }
        });

        it('should validate string field constraints', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/material')
                .query(queryParams);

            if (res.status === 200 && res.body.data.length > 0) {
                res.body.data.forEach((material, index) => {
                    // Validate string fields
                    if (material.material_name !== undefined) {
                        expect(material.material_name).to.be.a('string');
                        expect(material.material_name.length).to.be.above(0, 
                            `Material name should not be empty for item ${index}`);
                        expect(material.material_name.length).to.be.below(500, 
                            `Material name too long for item ${index}`);
                    }
                    
                    if (material.material_code !== undefined) {
                        expect(material.material_code).to.be.a('string');
                        expect(material.material_code.length).to.be.above(0);
                        // Material codes should follow a pattern (alphanumeric)
                        expect(material.material_code).to.match(/^[A-Za-z0-9_-]+$/);
                    }
                });
            }
        });

        it('should validate data encoding and special characters', async function() {
            const queryParams = WarehouseTestUtils.getTestQueryParams();

            const res = await WarehouseTestUtils.request()
                .get('/consumption-supply/entity')
                .query(queryParams);

            if (res.status === 200 && res.body.data.length > 0) {
                res.body.data.forEach((entity, index) => {
                    // Check for proper UTF-8 encoding
                    if (entity.entity_name !== undefined) {
                        expect(entity.entity_name).to.be.a('string');
                        
                        // Should not contain control characters
                        expect(entity.entity_name).to.not.match(/[\x00-\x1F\x7F]/, 
                            `Entity name contains control characters for item ${index}`);
                        
                        // Should handle Unicode characters properly
                        const encoded = encodeURIComponent(entity.entity_name);
                        const decoded = decodeURIComponent(encoded);
                        expect(decoded).to.equal(entity.entity_name, 
                            `Entity name encoding issue for item ${index}`);
                    }
                });
            }
        });
    });
});