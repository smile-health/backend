const { request, expect } = require('../base.test');

describe('Material Type API', function() {
    this.timeout(5000);

    // GET /material-types/
    describe('GET /material-types/', function() {
        it('should return a list of material types', async function() {
            const query = {
                page: 1,
                limit: 10
            };
            const res = await request().get('/material-types/').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });

        it('should return 204 No Content if no material types found', async function() {
            const query = {
                page: 1,
                limit: 10,
                keyword: 'nonexistenttype'
            };
            const res = await request().get('/material-types/').query(query);
            expect(res).to.have.status(204);
        });
    });
});
