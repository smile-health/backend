const { request, expect } = require('../base.test');

describe('Budget Source API', function() {
    this.timeout(5000);

    // GET /budget-sources/xls
    describe('GET /budget-sources/xls', function() {
        it('should export budget sources to excel', async function() {
            const query = {
                page: 1,
                limit: 10,
                program_ids: '1,2', // Placeholder for valid program IDs
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get('/budget-sources/xls').query(query);
            expect(res).to.have.status(200);
            expect(res).to.have.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    // GET /budget-sources/
    describe('GET /budget-sources/', function() {
        it('should return a list of budget sources', async function() {
            const query = {
                page: 1,
                limit: 10,
                program_ids: '1,2', // Placeholder
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get('/budget-sources/').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });
    });

    // GET /budget-sources/:id
    describe('GET /budget-sources/:id', function() {
        it('should return a single budget source by ID', async function() {
            const budgetSourceId = 1; // Placeholder for a valid budget source ID
            const res = await request().get(`/budget-sources/${budgetSourceId}`);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('id', budgetSourceId);
        });

        it('should return 404 for a non-existent budget source ID', async function() {
            const nonExistentId = 999999999;
            const res = await request().get(`/budget-sources/${nonExistentId}`);
            expect(res).to.have.status(404);
        });
    });
});
