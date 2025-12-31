const { request, expect } = require('../base.test');

describe('Program API', function() {
    this.timeout(5000);

    // GET /programs/
    describe('GET /programs/', function() {
        it('should return a list of programs', async function() {
            const query = {
                page: 1,
                limit: 10,
                is_hierarchy_enabled: '1', // Placeholder: '0' or '1'
                is_batch_enabled: '1', // Placeholder: '0' or '1'
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get('/programs/').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });

        it('should return 204 No Content if no programs found', async function() {
            const query = {
                page: 1,
                limit: 10,
                keyword: 'nonexistentprogram'
            };
            const res = await request().get('/programs/').query(query);
            expect(res).to.have.status(204);
        });
    });

    // GET /programs/xls
    describe('GET /programs/xls', function() {
        it('should export programs to excel', async function() {
            const query = {
                page: 1,
                limit: 10,
                is_hierarchy_enabled: '1', // Placeholder: '0' or '1'
                is_batch_enabled: '1', // Placeholder: '0' or '1'
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get('/programs/xls').query(query);
            expect(res).to.have.status(200);
            expect(res).to.have.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    // GET /programs/:id
    describe('GET /programs/:id', function() {
        it('should return a single program by ID', async function() {
            const programId = 1; // Placeholder for a valid program ID
            const res = await request().get(`/programs/${programId}`);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('id', programId);
        });

        it('should return 404 for a non-existent program ID', async function() {
            const nonExistentId = 999999999;
            const res = await request().get(`/programs/${nonExistentId}`);
            expect(res).to.have.status(404);
        });
    });
});
