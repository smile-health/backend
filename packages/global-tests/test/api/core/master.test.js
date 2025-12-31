const { request, expect } = require('../base.test');

describe('Master API', function() {
    this.timeout(5000);

    // GET /master/provinces
    describe('GET /master/provinces', function() {
        it('should return a list of provinces', async function() {
            const query = {
                page: 1,
                limit: 10,
                parent_id: '0' // Parent ID for provinces
            };
            const res = await request().get('/master/provinces').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });
    });

    // GET /master/regencies
    describe('GET /master/regencies', function() {
        it('should return a list of regencies', async function() {
            const query = {
                page: 1,
                limit: 10,
                parent_id: '1' // Placeholder for a valid province ID
            };
            const res = await request().get('/master/regencies').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });
    });

    // GET /master/subdistricts
    describe('GET /master/subdistricts', function() {
        it('should return a list of subdistricts', async function() {
            const query = {
                page: 1,
                limit: 10,
                parent_id: '1' // Placeholder for a valid regency ID
            };
            const res = await request().get('/master/subdistricts').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });
    });

    // GET /master/villages
    describe('GET /master/villages', function() {
        it('should return a list of villages', async function() {
            const query = {
                page: 1,
                limit: 10,
                parent_id: '1' // Placeholder for a valid subdistrict ID
            };
            const res = await request().get('/master/villages').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });
    });

    // GET /master/roles
    describe('GET /master/roles', function() {
        it('should return a list of roles', async function() {
            const res = await request().get('/master/roles');
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('list').and.to.be.an('array');
        });
    });
});
