const { request, expect } = require('../base.test');

describe('Entity API', function() {
    this.timeout(5000);

    // GET /entities/
    describe('GET /entities/', function() {
        it('should return a list of entities', async function() {
            const query = {
                page: 1,
                limit: 10,
                keyword: 'test',
                province_ids: '1,2', // Placeholder
                regency_ids: '3,4', // Placeholder
                sub_district_ids: '5', // Placeholder
                village_ids: '6', // Placeholder
                entity_tag_ids: '7', // Placeholder
                program_ids: '8', // Placeholder
                type_ids: '9', // Placeholder
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get('/entities/').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });

        it('should return 204 No Content if no entities found', async function() {
            // Assuming a query that returns no content
            const query = {
                keyword: 'nonexistententity'
            };
            const res = await request().get('/entities/').query(query);
            expect(res).to.have.status(204);
        });
    });

    // GET /entities/xls
    describe('GET /entities/xls', function() {
        it('should export entities to excel', async function() {
            const query = {
                page: 1,
                limit: 10,
                keyword: 'test',
                province_ids: '1,2', // Placeholder
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get('/entities/xls').query(query);
            expect(res).to.have.status(200);
            expect(res).to.have.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    // GET /entities/xls-template
    describe('GET /entities/xls-template', function() {
        it('should return an entities excel template', async function() {
            const res = await request().get('/entities/xls-template');
            expect(res).to.have.status(200);
            expect(res).to.have.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    // GET /entities/:id
    describe('GET /entities/:id', function() {
        it('should return a single entity by ID', async function() {
            const entityId = 1; // Placeholder for a valid entity ID
            const res = await request().get(`/entities/${entityId}`);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('id', entityId);
        });

        it('should return 404 for a non-existent entity ID', async function() {
            const nonExistentId = 999999999;
            const res = await request().get(`/entities/${nonExistentId}`);
            expect(res).to.have.status(404);
        });
    });
});
