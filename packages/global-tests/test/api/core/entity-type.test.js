const { request, expect } = require('../base.test');

describe('Entity Type API', function() {
    this.timeout(5000);

    // GET /entity-types/
    describe('GET /entity-types/', function() {
        it('should return a list of entity types', async function() {
            const query = {
                page: 1,
                limit: 10,
                sort_by: 'name',
                sort_type: 'asc'
            };
            const res = await request().get('/entity-types/').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });

        it('should return 204 No Content if no entity types found', async function() {
            // Assuming a query that returns no content
            const query = {
                page: 1,
                limit: 10,
                keyword: 'nonexistenttype'
            };
            const res = await request().get('/entity-types/').query(query);
            expect(res).to.have.status(204);
        });
    });
});
