const { request, expect } = require('../base.test');

describe('Entity Tag API', function() {
    this.timeout(5000);

    // GET /entity-tags/
    describe('GET /entity-tags/', function() {
        it('should return a list of entity tags', async function() {
            const query = {
                page: 1,
                limit: 10,
                sort_by: 'title',
                sort_type: 'asc'
            };
            const res = await request().get('/entity-tags/').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });

        it('should return 204 No Content if no entity tags found', async function() {
            // Assuming a query that returns no content
            const query = {
                page: 1,
                limit: 10,
                keyword: 'nonexistenttag'
            };
            const res = await request().get('/entity-tags/').query(query);
            expect(res).to.have.status(204);
        });
    });
});
