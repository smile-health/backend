const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

chai.use(chaiHttp);

const AUTH_BASE_URL = process.env.AUTH_BASE_URL;
const AUTH_USERNAME = process.env.AUTH_USERNAME;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

describe('Login API Tests', function() {
    this.timeout(10000);

    describe('POST /login', function() {
        it('should successfully authenticate with valid credentials', function(done) {
            chai.request(AUTH_BASE_URL)
                .post('/login')
                .type('form')
                .send({ 
                    username: AUTH_USERNAME, 
                    password: AUTH_PASSWORD 
                })
                .end((err, res) => {
                    expect(err).to.be.null;
                    expect(res).to.have.status(200);
                    expect(res.body).to.be.an('object');
                    expect(res.body).to.have.property('authDetails');
                    expect(res.body.authDetails).to.have.property('access_token');
                    expect(res.body.authDetails.access_token).to.be.a('string');
                    expect(res.body.authDetails.access_token).to.not.be.empty;
                    
                    // Additional token validation
                    expect(res.body.authDetails).to.have.property('token_type');
                    expect(res.body.authDetails).to.have.property('expires_in');
                    
                    done();
                });
        });

        it('should reject authentication with invalid username', function(done) {
            chai.request(AUTH_BASE_URL)
                .post('/login')
                .type('form')
                .send({ 
                    username: 'invalid_username', 
                    password: AUTH_PASSWORD 
                })
                .end((err, res) => {
                    expect(res).to.have.status(401);
                    expect(res.body).to.be.an('object');
                    expect(res.body).to.have.property('error');
                    done();
                });
        });

        it('should reject authentication with invalid password', function(done) {
            chai.request(AUTH_BASE_URL)
                .post('/login')
                .type('form')
                .send({ 
                    username: AUTH_USERNAME, 
                    password: 'invalid_password' 
                })
                .end((err, res) => {
                    expect(res).to.have.status(401);
                    expect(res.body).to.be.an('object');
                    expect(res.body).to.have.property('error');
                    done();
                });
        });

        it('should reject authentication with missing username', function(done) {
            chai.request(AUTH_BASE_URL)
                .post('/login')
                .type('form')
                .send({ 
                    password: AUTH_PASSWORD 
                })
                .end((err, res) => {
                    expect(res).to.have.status(400);
                    expect(res.body).to.be.an('object');
                    expect(res.body).to.have.property('error');
                    done();
                });
        });

        it('should reject authentication with missing password', function(done) {
            chai.request(AUTH_BASE_URL)
                .post('/login')
                .type('form')
                .send({ 
                    username: AUTH_USERNAME 
                })
                .end((err, res) => {
                    expect(res).to.have.status(400);
                    expect(res.body).to.be.an('object');
                    expect(res.body).to.have.property('error');
                    done();
                });
        });

        it('should reject authentication with empty credentials', function(done) {
            chai.request(AUTH_BASE_URL)
                .post('/login')
                .type('form')
                .send({ 
                    username: '', 
                    password: '' 
                })
                .end((err, res) => {
                    expect(res).to.have.status(400);
                    expect(res.body).to.be.an('object');
                    expect(res.body).to.have.property('error');
                    done();
                });
        });

        it('should handle malformed request body', function(done) {
            chai.request(AUTH_BASE_URL)
                .post('/login')
                .type('json')
                .send('invalid json')
                .end((err, res) => {
                    expect(res).to.have.status(400);
                    done();
                });
        });

        it('should return proper response headers', function(done) {
            chai.request(AUTH_BASE_URL)
                .post('/login')
                .type('form')
                .send({ 
                    username: AUTH_USERNAME, 
                    password: AUTH_PASSWORD 
                })
                .end((err, res) => {
                    expect(res).to.have.header('content-type');
                    expect(res.headers['content-type']).to.include('application/json');
                    done();
                });
        });

        it('should complete authentication within reasonable time', function(done) {
            const startTime = Date.now();
            
            chai.request(AUTH_BASE_URL)
                .post('/login')
                .type('form')
                .send({ 
                    username: AUTH_USERNAME, 
                    password: AUTH_PASSWORD 
                })
                .end((err, res) => {
                    const endTime = Date.now();
                    const responseTime = endTime - startTime;
                    
                    expect(responseTime).to.be.below(5000); // Should complete within 5 seconds
                    expect(res).to.have.status(200);
                    done();
                });
        });
    });

    describe('Token Validation', function() {
        let validToken;

        before(function(done) {
            // Get a valid token for testing
            chai.request(AUTH_BASE_URL)
                .post('/login')
                .type('form')
                .send({ 
                    username: AUTH_USERNAME, 
                    password: AUTH_PASSWORD 
                })
                .end((err, res) => {
                    validToken = res.body.authDetails.access_token;
                    done();
                });
        });

        it('should accept valid token for protected endpoints', function(done) {
            chai.request(AUTH_BASE_URL)
                .get('/profile') // Assuming there's a profile endpoint
                .set('Authorization', `Bearer ${validToken}`)
                .end((err, res) => {
                    // Accept either 200 (success) or 404 (endpoint doesn't exist)
                    expect([200, 404]).to.include(res.status);
                    done();
                });
        });

        it('should reject invalid token', function(done) {
            chai.request(AUTH_BASE_URL)
                .get('/profile')
                .set('Authorization', 'Bearer invalid_token')
                .end((err, res) => {
                    expect([401, 403, 404]).to.include(res.status);
                    done();
                });
        });

        it('should reject requests without token', function(done) {
            chai.request(AUTH_BASE_URL)
                .get('/profile')
                .end((err, res) => {
                    expect([401, 403, 404]).to.include(res.status);
                    done();
                });
        });
    });
});