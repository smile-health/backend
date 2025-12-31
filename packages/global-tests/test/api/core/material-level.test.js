const { request, expect } = require('../base.test');

describe('Material Level API', function() {
    this.timeout(5000);

    // GET /material-levels/
    describe('GET /material-levels/', function() {
        it('should return a list of material levels', async function() {
            const query = {
                page: 1,
                limit: 10,
                enable_only: '1' // Placeholder: '0' or '1'
            };
            const res = await request().get('/material-levels/').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });

        it('should return 204 No Content if no material levels found', async function() {
            const query = {
                page: 1,
                limit: 10,
                keyword: 'nonexistentlevel'
            };
            const res = await request().get('/material-levels/').query(query);
            expect(res).to.have.status(204);
        });
    });
});
