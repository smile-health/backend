const { request, expect, getAuthToken } = require('../base.test');

describe('User External API', function() {
    this.timeout(5000);

    // GET /users/ext/
    describe('GET /users/ext/', function() {
        it('should return 422 for missing required parameters', async function() {
            const query = {
                page: 1,
                limit: 10
            };
            const res = await request().get('/users/ext/').query(query).set('Authorization', `Bearer ${getAuthToken()}`);
            expect(res).to.have.status(422);
        });

        it('should return 422 for invalid search parameters', async function() {
            const query = {
                page: 1,
                limit: 10,
                keyword: 'nonexistentexternaluser'
            };
            const res = await request().get('/users/ext/').query(query).set('Authorization', `Bearer ${getAuthToken()}`);
            expect(res).to.have.status(422);
        });
    });

    // GET /users/ext/:id
    describe('GET /users/ext/:id', function() {
        it('should return a single external user by ID', async function() {
            const externalUserId = 1; // Placeholder for a valid external user ID
            const res = await request().get(`/users/ext/${externalUserId}`).set('Authorization', `Bearer ${getAuthToken()}`);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('id', externalUserId);
        });

        it('should return 404 for a non-existent external user ID', async function() {
            const nonExistentId = 999999999;
            const res = await request().get(`/users/ext/${nonExistentId}`).set('Authorization', `Bearer ${getAuthToken()}`);
            expect(res).to.have.status(404);
        });
    });
});
