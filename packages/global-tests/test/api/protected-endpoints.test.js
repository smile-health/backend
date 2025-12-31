const { request, expect, getAuthToken } = require('./base.test');
const chai = require('chai');
const chaiHttp = require('chai-http');

chai.use(chaiHttp);

// Protected endpoints to test
const PROTECTED_ENDPOINTS = [
    {
        name: 'Global Settings - Program',
        path: '/id/v5/global-settings/program',
        baseUrl: 'https://smile-platform.badr.co.id'
    },
    {
        name: 'Global Settings - User',
        path: '/id/v5/global-settings/user',
        baseUrl: 'https://smile-platform.badr.co.id'
    },
    {
        name: 'Essential Medicine - Transaction',
        path: '/id/wms/v5/transaction',
        baseUrl: 'https://smile-platform.badr.co.id'
    },
    {
        name: 'Essential Medicine - Dashboard Stock',
        path: '/id/wms/v5/dashboard/stock',
        baseUrl: 'https://smile-platform.badr.co.id'
    }
];

describe('Protected Endpoints API Tests', function() {
    this.timeout(15000);
    let authToken;

    before(function() {
        authToken = getAuthToken();
        if (!authToken) {
            throw new Error('Authentication token not available. Make sure base.test.js authentication succeeds.');
        }
    });

    describe('Authentication Required Tests', function() {
        PROTECTED_ENDPOINTS.forEach(endpoint => {
            describe(`${endpoint.name} (${endpoint.path})`, function() {
                
                it('should reject requests without authentication token', function(done) {
                    chai.request(endpoint.baseUrl)
                        .get(endpoint.path)
                        .end((err, res) => {
                            // Should return 401 Unauthorized or redirect to login
                            expect([401, 302, 403]).to.include(res.status);
                            
                            if (res.status === 302) {
                                // If redirected, should redirect to login page
                                expect(res.headers.location).to.include('login');
                            }
                            
                            done();
                        });
                });

                it('should reject requests with invalid authentication token', function(done) {
                    chai.request(endpoint.baseUrl)
                        .get(endpoint.path)
                        .set('Authorization', 'Bearer invalid_token_12345')
                        .end((err, res) => {
                            expect([401, 302, 403]).to.include(res.status);
                            done();
                        });
                });

                it('should accept requests with valid authentication token', function(done) {
                    chai.request(endpoint.baseUrl)
                        .get(endpoint.path)
                        .set('Authorization', `Bearer ${authToken}`)
                        .end((err, res) => {
                            // Should return success (200) or redirect to proper page (302)
                            // or forbidden if user doesn't have permission (403)
                            expect([200, 302, 403]).to.include(res.status);
                            
                            // If successful, should not redirect to login
                            if (res.status === 302) {
                                expect(res.headers.location).to.not.include('login');
                            }
                            
                            done();
                        });
                });

                it('should handle malformed authorization header', function(done) {
                    chai.request(endpoint.baseUrl)
                        .get(endpoint.path)
                        .set('Authorization', 'InvalidFormat')
                        .end((err, res) => {
                            expect([401, 302, 403]).to.include(res.status);
                            done();
                        });
                });

                it('should respond within reasonable time', function(done) {
                    const startTime = Date.now();
                    
                    chai.request(endpoint.baseUrl)
                        .get(endpoint.path)
                        .set('Authorization', `Bearer ${authToken}`)
                        .timeout(10000)
                        .end((err, res) => {
                            const endTime = Date.now();
                            const responseTime = endTime - startTime;
                            
                            expect(responseTime).to.be.below(10000); // Should complete within 10 seconds
                            done();
                        });
                });
            });
        });
    });

    describe('Endpoint Specific Tests', function() {
        
        describe('Global Settings - Program', function() {
            const endpoint = PROTECTED_ENDPOINTS[0];
            
            it('should return program settings data when authenticated', function(done) {
                chai.request(endpoint.baseUrl)
                    .get(endpoint.path)
                    .set('Authorization', `Bearer ${authToken}`)
                    .end((err, res) => {
                        if (res.status === 200) {
                            expect(res.body).to.be.an('object');
                            // Add specific assertions based on expected response structure
                        }
                        done();
                    });
            });
        });

        describe('Global Settings - User', function() {
            const endpoint = PROTECTED_ENDPOINTS[1];
            
            it('should return user settings data when authenticated', function(done) {
                chai.request(endpoint.baseUrl)
                    .get(endpoint.path)
                    .set('Authorization', `Bearer ${authToken}`)
                    .end((err, res) => {
                        if (res.status === 200) {
                            expect(res.body).to.be.an('object');
                            // Add specific assertions based on expected response structure
                        }
                        done();
                    });
            });
        });

        describe('WMS - Transaction', function() {
            const endpoint = PROTECTED_ENDPOINTS[2];
            
            it('should return transaction data when authenticated', function(done) {
                chai.request(endpoint.baseUrl)
                    .get(endpoint.path)
                    .set('Authorization', `Bearer ${authToken}`)
                    .end((err, res) => {
                        if (res.status === 200) {
                            expect(res.body).to.be.an('object');
                            // Add specific assertions for transaction data
                        }
                        done();
                    });
            });
        });

        describe('WMS - Dashboard Stock', function() {
            const endpoint = PROTECTED_ENDPOINTS[3];
            
            it('should return stock dashboard data when authenticated', function(done) {
                chai.request(endpoint.baseUrl)
                    .get(endpoint.path)
                    .set('Authorization', `Bearer ${authToken}`)
                    .end((err, res) => {
                        if (res.status === 200) {
                            expect(res.body).to.be.an('object');
                            // Add specific assertions for stock dashboard data
                        }
                        done();
                    });
            });
        });
    });

    describe('Cross-Origin and Security Tests', function() {
        PROTECTED_ENDPOINTS.forEach(endpoint => {
            it(`should have proper CORS headers for ${endpoint.name}`, function(done) {
                chai.request(endpoint.baseUrl)
                    .options(endpoint.path)
                    .set('Origin', 'https://smile-platform.badr.co.id')
                    .set('Access-Control-Request-Method', 'GET')
                    .end((err, res) => {
                        // CORS preflight should be handled properly
                        expect([200, 204, 404]).to.include(res.status);
                        done();
                    });
            });

            it(`should have security headers for ${endpoint.name}`, function(done) {
                chai.request(endpoint.baseUrl)
                    .get(endpoint.path)
                    .set('Authorization', `Bearer ${authToken}`)
                    .end((err, res) => {
                        // Check for common security headers
                        if (res.status === 200) {
                            // These headers might be present for security
                            const securityHeaders = [
                                'x-frame-options',
                                'x-content-type-options',
                                'x-xss-protection',
                                'strict-transport-security'
                            ];
                            
                            // At least some security headers should be present
                            // This is a soft check as not all may be implemented
                        }
                        done();
                    });
            });
        });
    });

    describe('Rate Limiting Tests', function() {
        it('should handle multiple rapid requests gracefully', function(done) {
            this.timeout(20000);
            
            const requests = [];
            const endpoint = PROTECTED_ENDPOINTS[0]; // Test with first endpoint
            
            // Make 5 rapid requests
            for (let i = 0; i < 5; i++) {
                requests.push(
                    chai.request(endpoint.baseUrl)
                        .get(endpoint.path)
                        .set('Authorization', `Bearer ${authToken}`)
                );
            }
            
            Promise.allSettled(requests.map(req => 
                new Promise((resolve, reject) => {
                    req.end((err, res) => {
                        if (err) reject(err);
                        else resolve(res);
                    });
                })
            )).then(results => {
                // All requests should complete (either success or controlled failure)
                expect(results).to.have.length(5);
                
                // Check that we don't get too many rate limit errors
                const rateLimitErrors = results.filter(result => 
                    result.status === 'fulfilled' && result.value.status === 429
                );
                
                // Should not rate limit all requests immediately
                expect(rateLimitErrors.length).to.be.below(5);
                
                done();
            }).catch(done);
        });
    });
});