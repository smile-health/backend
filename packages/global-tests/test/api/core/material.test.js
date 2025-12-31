const { request, expect } = require('../base.test');

describe('Material API', function() {
    this.timeout(5000);

    // GET /materials/
    describe('GET /materials/', function() {
        it('should return a list of materials', async function() {
            const query = {
                page: 1,
                limit: 10,
                program_ids: '1,2', // Placeholder
                material_level_ids: '1', // Placeholder
                material_type_ids: '1', // Placeholder
                is_hierarchy: '1', // Placeholder: '0' or '1'
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get('/materials/').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });

        it('should return 204 No Content if no materials found', async function() {
            const query = {
                keyword: 'nonexistentmaterial'
            };
            const res = await request().get('/materials/').query(query);
            expect(res).to.have.status(204);
        });
    });

    // GET /materials/xls
    describe('GET /materials/xls', function() {
        it('should export materials to excel', async function() {
            const query = {
                page: 1,
                limit: 10,
                program_ids: '1,2', // Placeholder
                material_level_ids: '1', // Placeholder
                material_type_ids: '1', // Placeholder
                is_hierarchy: '1', // Placeholder: '0' or '1'
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get('/materials/xls').query(query);
            expect(res).to.have.status(200);
            expect(res).to.have.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    // GET /materials/xls-template
    describe('GET /materials/xls-template', function() {
        it('should return a materials excel template', async function() {
            const query = {
                material_level_id: 1, // Placeholder
                is_hierarchy: 0 // Placeholder: 0 or 1
            };
            const res = await request().get('/materials/xls-template').query(query);
            expect(res).to.have.status(200);
            expect(res).to.have.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });
    });

    // GET /materials/:id
    describe('GET /materials/:id', function() {
        it('should return a single material by ID', async function() {
            const materialId = 1; // Placeholder for a valid material ID
            const res = await request().get(`/materials/${materialId}`);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('id', materialId);
        });

        it('should return 404 for a non-existent material ID', async function() {
            const nonExistentId = 999999999;
            const res = await request().get(`/materials/${nonExistentId}`);
            expect(res).to.have.status(404);
        });
    });

    // GET /materials/:id/relation
    describe('GET /materials/:id/relation', function() {
        it('should return material relations by ID', async function() {
            const materialId = 1; // Placeholder for a valid material ID
            const res = await request().get(`/materials/${materialId}/relation`);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object'); // Assuming it returns an object with relation details
        });

        it('should return 404 for a non-existent material ID for relations', async function() {
            const nonExistentId = 999999999;
            const res = await request().get(`/materials/${nonExistentId}/relation`);
            expect(res).to.have.status(404);
        });
    });
});
