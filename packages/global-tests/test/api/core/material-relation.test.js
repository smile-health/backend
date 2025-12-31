const { request, expect } = require('../base.test');

describe('Material Relation API', function() {
    this.timeout(5000);

    // GET /material-relations/
    describe('GET /material-relations/', function() {
        it('should return a list of material relations', async function() {
            const query = {
                page: 1,
                limit: 10
            };
            const res = await request().get('/material-relations/').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });

        it('should return 204 No Content if no material relations found', async function() {
            const query = {
                page: 1,
                limit: 10,
                keyword: 'nonexistentrelation'
            };
            const res = await request().get('/material-relations/').query(query);
            expect(res).to.have.status(204);
        });
    });
});
