const { request, expect } = require('../base.test');

describe('Manufacture API', function() {
    this.timeout(5000);

    // GET /manufactures/type
    describe('GET /manufactures/type', function() {
        it('should return a list of manufacture types', async function() {
            const res = await request().get('/manufactures/type');
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('array'); // Assuming it returns an array of types
        });
    });

    // GET /manufactures/xls
    describe('GET /manufactures/xls', function() {
        it('should export manufactures to excel', async function() {
            const query = {
                page: 1,
                limit: 10,
                type: 1, // Placeholder
                status: 1, // Placeholder
                program_ids: '1,2', // Placeholder
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get('/manufactures/xls').query(query);
            expect(res).to.have.status(200);
            expect(res).to.have.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    // GET /manufactures/xls-template
    describe('GET /manufactures/xls-template', function() {
        it('should return a manufactures excel template', async function() {
            const res = await request().get('/manufactures/xls-template');
            expect(res).to.have.status(200);
            expect(res).to.have.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    // GET /manufactures/
    describe('GET /manufactures/', function() {
        it('should return a list of manufactures', async function() {
            const query = {
                page: 1,
                limit: 10,
                type: 1, // Placeholder
                status: 1, // Placeholder
                program_ids: '1,2', // Placeholder
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get('/manufactures/').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });
    });

    // GET /manufactures/:id
    describe('GET /manufactures/:id', function() {
        it('should return a single manufacture by ID', async function() {
            const manufactureId = 1; // Placeholder for a valid manufacture ID
            const res = await request().get(`/manufactures/${manufactureId}`);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('id', manufactureId);
        });

        it('should return 404 for a non-existent manufacture ID', async function() {
            const nonExistentId = 999999999;
            const res = await request().get(`/manufactures/${nonExistentId}`);
            expect(res).to.have.status(404);
        });
    });
});
