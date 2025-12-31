const { request, expect, getAuthToken } = require('../base.test');

describe('User API', function() {
    this.timeout(10000);

    // GET /users/xls
    describe('GET /users/xls', function() {
        it('should export users to excel', async function() {
            const query = {
                page: 1,
                paginate: 10,
            };
            const res = await request().get('/users/xls').query(query).set('Authorization', `Bearer ${getAuthToken()}`);
            expect(res).to.have.status(200);
            expect(res).to.have.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    // GET /users/xls-template
    describe('GET /users/xls-template', function() {
        it('should return a users excel template', async function() {
            const res = await request().get('/users/xls-template').set('Authorization', `Bearer ${getAuthToken()}`);
            expect(res).to.have.status(200);
            expect(res).to.have.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    // GET /users/
    describe('GET /users/', function() {
        it('should return a list of users', async function() {
            const query = {
                page: 1,
                paginate: 10,
            };
            const res = await request().get('/users/').query(query).set('Authorization', `Bearer ${getAuthToken()}`);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });

        it('should return 204 No Content if no users found', async function() {
            const query = {
                page: 1,
                paginate: 10,
                keyword: 'nonexistentuser'
            };
            const res = await request().get('/users/').query(query).set('Authorization', `Bearer ${getAuthToken()}`);
            expect(res).to.have.status(204);
        });
    });

    // GET /users/:id
    describe('GET /users/:id', function() {
        it('should return a single user by ID', async function() {
            const userId = 1; // Placeholder for a valid user ID
            const res = await request().get(`/users/${userId}`).set('Authorization', `Bearer ${getAuthToken()}`);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('id', userId);
        });

        it('should return 404 for a non-existent user ID', async function() {
            const nonExistentId = 999999999;
            const res = await request().get(`/users/${nonExistentId}`).set('Authorization', `Bearer ${getAuthToken()}`);
            expect(res).to.have.status(404);
        });
    });

    // GET /users/:id/chg_history
    describe('GET /users/:id/chg_history', function() {
        it('should return user change history by ID', async function() {
            const userId = 1; // Placeholder for a valid user ID
            const res = await request().get(`/users/${userId}/chg_history`).set('Authorization', `Bearer ${getAuthToken()}`);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('array'); // Assuming it returns an array of change logs
        });

        it('should return 200 for a non-existent user ID for change history', async function() {
            const nonExistentId = 999999999;
            const res = await request().get(`/users/${nonExistentId}/chg_history`).set('Authorization', `Bearer ${getAuthToken()}`);
            expect(res).to.have.status(200);
        });
    });
});
