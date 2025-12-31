const { request, expect, getAuthToken } = require('../base.test');

describe('Account API', function() {
    this.timeout(5000); // Set a timeout for this test suite

    describe('GET /account/workspaces', function() {
        it('should return a list of workspaces', async function() {
            const res = await request()
                .get('/account/workspaces')
                .set('Authorization', `Bearer ${getAuthToken()}`); // Chain .set() here
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('workspaces').and.to.be.an('array');
        });
    });

    describe('GET /account/profile', function() {
        it('should return the user profile', async function() {
            const res = await request()
                .get('/account/profile')
                .set('Authorization', `Bearer ${getAuthToken()}`); // Chain .set() here
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('id');
            expect(res.body).to.have.property('username');
        });
    });
});
