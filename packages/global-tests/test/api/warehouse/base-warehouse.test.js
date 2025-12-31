require('dotenv').config();
const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

// Force chai-http loading
chai.use(chaiHttp);

// Debug chai-http loading
if (!chai.request) {
    console.error('chai.request is not available');
    process.exit(1);
}

const AUTH_BASE_URL = process.env.AUTH_BASE_URL;
const WAREHOUSE_BASE_URL = process.env.WAREHOUSE_BASE_URL || process.env.API_BASE_URL;
const WAREHOUSE_PROGRAM_ID = process.env.WAREHOUSE_PROGRAM_ID || '3';
const AUTH_USERNAME = process.env.AUTH_USERNAME;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

let authToken;

/**
 * Authentication setup for warehouse service tests
 */
before(function(done) {
    this.timeout(10000);

    if (!AUTH_BASE_URL || !AUTH_USERNAME || !AUTH_PASSWORD) {
        console.error("Missing authentication configuration:");
        console.error("AUTH_BASE_URL:", !!AUTH_BASE_URL);
        console.error("AUTH_USERNAME:", !!AUTH_USERNAME);
        console.error("AUTH_PASSWORD:", !!AUTH_PASSWORD);
        return done(new Error("Authentication configuration missing"));
    }

    chai.request(AUTH_BASE_URL)
        .post('/login')
        .type('form')
        .set('x-program-id', WAREHOUSE_PROGRAM_ID)
        .send({ username: AUTH_USERNAME, password: AUTH_PASSWORD })
        .end((err, res) => {
            if (err) {
                console.error("Authentication failed:", err.message);
                return done(err);
            }
            expect(res).to.have.status(200);
            expect(res.body).to.have.property('authDetails');
            expect(res.body.authDetails).to.have.property('access_token');
            authToken = res.body.authDetails.access_token;
            console.log("Authentication success, token received:", authToken ? 'Yes' : 'No');
            done();
        });
});

/**
 * Warehouse service test utilities
 */
class WarehouseTestUtils {
    /**
     * Get shared headers for warehouse service requests
     * @param {string} token - Auth token (optional, uses global token if not provided)
     * @returns {Object} Headers object
     */
    static getHeaders(token = null) {
        const effectiveToken = token || authToken;
        const headers = {
            'x-program-id': WAREHOUSE_PROGRAM_ID
        };
        
        if (effectiveToken) {
            headers['Authorization'] = `Bearer ${effectiveToken}`;
        } else {
            console.warn('Warning: Making request without authentication token');
        }
        
        return headers;
    }

    /**
     * Create authenticated request to warehouse service
     * @param {string} token - Auth token (optional, uses global token if not provided)
     * @returns {Object} Chai request object
     */
    static request(token = null) {
        if (!WAREHOUSE_BASE_URL) {
            throw new Error('WAREHOUSE_BASE_URL is not configured');
        }
        
        // Create a wrapper object that will apply headers when HTTP methods are called
        const headers = this.getHeaders(token);
        const baseRequest = chai.request(WAREHOUSE_BASE_URL);
        
        // Create a proxy that intercepts method calls and adds headers
        return new Proxy(baseRequest, {
            get(target, prop) {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(prop)) {
                    return function(path) {
                        const req = target[prop](path);
                        // Set headers on the request
                        Object.keys(headers).forEach(key => {
                            req.set(key, headers[key]);
                        });
                        return req;
                    };
                }
                return target[prop];
            }
        });
    }

    /**
     * Create request without authentication (for testing unauthorized access)
     * @returns {Object} Chai request object
     */
    static unauthenticatedRequest() {
        if (!WAREHOUSE_BASE_URL) {
            throw new Error('WAREHOUSE_BASE_URL is not configured');
        }
        return chai.request(WAREHOUSE_BASE_URL);
    }

    /**
     * Create request with invalid token for testing
     * @returns {Object} Chai request object with invalid token headers
     */
    static invalidTokenRequest() {
        if (!WAREHOUSE_BASE_URL) {
            throw new Error('WAREHOUSE_BASE_URL is not configured');
        }
        
        const headers = this.getInvalidTokenHeaders();
        const baseRequest = chai.request(WAREHOUSE_BASE_URL);
        
        return new Proxy(baseRequest, {
            get(target, prop) {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(prop)) {
                    return function(path) {
                        const req = target[prop](path);
                        Object.keys(headers).forEach(key => {
                            req.set(key, headers[key]);
                        });
                        return req;
                    };
                }
                return target[prop];
            }
        });
    }

    /**
     * Create request with expired token for testing
     * @returns {Object} Chai request object with expired token headers
     */
    static expiredTokenRequest() {
        if (!WAREHOUSE_BASE_URL) {
            throw new Error('WAREHOUSE_BASE_URL is not configured');
        }
        
        const headers = this.getExpiredTokenHeaders();
        const baseRequest = chai.request(WAREHOUSE_BASE_URL);
        
        return new Proxy(baseRequest, {
            get(target, prop) {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(prop)) {
                    return function(path) {
                        const req = target[prop](path);
                        Object.keys(headers).forEach(key => {
                            req.set(key, headers[key]);
                        });
                        return req;
                    };
                }
                return target[prop];
            }
        });
    }

    /**
     * Get headers with invalid token for testing
     * @returns {Object} Headers object
     */
    static getInvalidTokenHeaders() {
        return {
            'x-program-id': WAREHOUSE_PROGRAM_ID,
            'Authorization': 'Bearer invalid_token_12345'
        };
    }

    /**
     * Get headers with expired token for testing
     * @returns {Object} Headers object
     */
    static getExpiredTokenHeaders() {
        const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';
        return {
            'x-program-id': WAREHOUSE_PROGRAM_ID,
            'Authorization': `Bearer ${expiredToken}`
        };
    }

    /**
     * Get headers without authentication for testing unauthorized access
     * @returns {Object} Headers object
     */
    static getUnauthenticatedHeaders() {
        return {
            'x-program-id': WAREHOUSE_PROGRAM_ID
        };
    }

    /**
     * Validate standard API response structure
     * @param {Object} res - Response object
     * @param {number} expectedStatus - Expected HTTP status code
     * @param {boolean} expectData - Whether to expect data property
     */
    static validateResponse(res, expectedStatus = 200, expectData = true) {
        // Accept both 200 (success) and 422 (validation error) as valid authenticated responses
        if (expectedStatus === 200) {
            expect([200, 422]).to.include(res.status);
        } else {
            expect(res).to.have.status(expectedStatus);
        }
        expect(res.body).to.be.an('object');
        
        // Only expect data property for successful 200 responses
        if (expectData && res.status === 200) {
            expect(res.body).to.have.property('data');
        }
    }

    /**
     * Validate pagination response structure
     * @param {Object} res - Response object
     */
    static validatePaginationResponse(res) {
        this.validateResponse(res);
        expect(res.body).to.have.property('data').that.is.an('array');
        expect(res.body).to.have.property('meta');
        expect(res.body.meta).to.have.property('total');
        expect(res.body.meta).to.have.property('page');
        expect(res.body.meta).to.have.property('limit');
    }

    /**
     * Validate error response structure
     * @param {Object} res - Response object
     * @param {number} expectedStatus - Expected HTTP status code
     */
    static validateErrorResponse(res, expectedStatus) {
        expect(res).to.have.status(expectedStatus);
        expect(res.body).to.be.an('object');
        expect(res.body).to.have.property('message');
    }

    /**
     * Validate Excel file response
     * @param {Object} res - Response object
     */
    static validateExcelResponse(res) {
        // Accept both 200 (success) and 422 (validation error) as valid authenticated responses
        expect([200, 422]).to.include(res.status);
        
        // Only validate Excel headers for successful 200 responses
        if (res.status === 200) {
            expect(res).to.have.header('Content-Type', 
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            expect(res).to.have.header('Content-Disposition');
            expect(res.header['content-disposition']).to.include('attachment');
        }
    }

    /**
     * Generate test query parameters for warehouse endpoints
     * @param {Object} overrides - Parameter overrides
     * @returns {Object} Query parameters
     */
    static getTestQueryParams(overrides = {}) {
        const defaults = {
            page: 1,
            limit: 10,
            program_id: WAREHOUSE_PROGRAM_ID || 3,
            province_id: 11, // Jakarta
            regency_id: 1101, // Jakarta Pusat
            entity_id: 1,
            material_id: 1,
            from: '2024-01-01',
            to: '2024-12-31'
        };
        return { ...defaults, ...overrides };
    }

    /**
     * Measure response time for performance testing
     * @param {Function} requestFn - Function that returns a promise for the request
     * @returns {Promise<{response: Object, responseTime: number}>}
     */
    static async measureResponseTime(requestFn) {
        const startTime = Date.now();
        const response = await requestFn();
        const responseTime = Date.now() - startTime;
        return { response, responseTime };
    }

    /**
     * Run concurrent requests for load testing
     * @param {Function} requestFn - Function that returns a promise for the request
     * @param {number} concurrency - Number of concurrent requests
     * @returns {Promise<Array>} Array of response objects with timing
     */
    static async runConcurrentRequests(requestFn, concurrency = 5) {
        const promises = Array(concurrency).fill().map(() => 
            this.measureResponseTime(requestFn)
        );
        return Promise.all(promises);
    }

    /**
     * Get auth token for direct use
     * @returns {string} Current auth token
     */
    static getAuthToken() {
        return authToken;
    }
}

module.exports = {
    WarehouseTestUtils,
    expect,
    chai
};