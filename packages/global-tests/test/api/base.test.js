require('dotenv').config();
const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

chai.use(chaiHttp);

const AUTH_BASE_URL = process.env.AUTH_BASE_URL;
const API_BASE_URL = process.env.API_BASE_URL;
const AUTH_USERNAME = process.env.AUTH_USERNAME;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

let authToken;

before(function(done) {
    this.timeout(10000); // Increase timeout for authentication

    chai.request(AUTH_BASE_URL)
        .post('/login')
        .type('form') // For application/x-www-form-urlencoded
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
            done();
        });
});

// The `after` hook to close the agent is no longer needed since a new request agent
// is created for each request, so there's no persistent agent to close.

module.exports = {
    request: () => chai.request(API_BASE_URL), // Only return the agent
    expect,
    getAuthToken: () => authToken // Export authToken for direct use
};
