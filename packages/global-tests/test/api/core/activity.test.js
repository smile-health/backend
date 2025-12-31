const { request, expect } = require('../base.test');

describe('Activity API', function() {
    this.timeout(5000);

    // GET /programs/:program_id/activities/xls
    describe('GET /programs/:program_id/activities/xls', function() {
        it('should export activities to excel', async function() {
            const programId = 1; // Placeholder for a valid program ID
            const query = {
                page: 1,
                limit: 10,
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get(`/programs/${programId}/activities/xls`).query(query);
            expect(res).to.have.status(200);
            expect(res).to.have.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    // GET /programs/:program_id/activities/xls-template
    describe('GET /programs/:program_id/activities/xls-template', function() {
        it('should return an activities excel template', async function() {
            const programId = 1; // Placeholder
            const res = await request().get(`/programs/${programId}/activities/xls-template`);
            expect(res).to.have.status(200);
            expect(res).to.have.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    // GET /programs/:program_id/activities/
    describe('GET /programs/:program_id/activities/', function() {
        it('should return a list of activities', async function() {
            const programId = 1; // Placeholder
            const query = {
                page: 1,
                limit: 10,
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get(`/programs/${programId}/activities/`).query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });
    });

    // GET /programs/:program_id/activities/:id
    describe('GET /programs/:program_id/activities/:id', function() {
        it('should return a single activity by ID', async function() {
            const programId = 1; // Placeholder
            const activityId = 1; // Placeholder for a valid activity ID
            const res = await request().get(`/programs/${programId}/activities/${activityId}`);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('id', activityId);
        });

        it('should return 404 for a non-existent activity ID', async function() {
            const programId = 1; // Placeholder
            const nonExistentActivityId = 999999999;
            const res = await request().get(`/programs/${programId}/activities/${nonExistentActivityId}`);
            expect(res).to.have.status(404);
        });
    });
});
