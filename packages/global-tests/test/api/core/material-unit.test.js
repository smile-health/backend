const { request, expect } = require('../base.test');

describe('Material Unit API', function() {
    this.timeout(5000);

    // GET /material-units/
    describe('GET /material-units/', function() {
        it('should return a list of material units', async function() {
            const query = {
                page: 1,
                limit: 10,
                type: 'example_type' // Placeholder
            };
            const res = await request().get('/material-units/').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });

        it('should return 204 No Content if no material units found', async function() {
            const query = {
                page: 1,
                limit: 10,
                type: 'nonexistenttype'
            };
            const res = await request().get('/material-units/').query(query);
            expect(res).to.have.status(204);
        });
    });
});
