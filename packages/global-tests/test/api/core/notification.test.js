const { request, expect } = require('../base.test');

describe('Notification API', function() {
    this.timeout(5000);

    // GET /notifications/
    describe('GET /notifications/', function() {
        it('should return a list of notifications', async function() {
            const query = {
                page: 1,
                limit: 10,
                province_id: 1, // Placeholder
                city_id: 1, // Placeholder
                health_center_id: 1, // Placeholder
                receive_date: '2023-01-01', // Placeholder
                received_end_date: '2023-12-31', // Placeholder
                notification_type: 'general', // Placeholder
                entity_tag_ids: '1,2', // Placeholder
                program_ids: '1,2' // Placeholder
            };
            const res = await request().get('/notifications/').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });

        it('should return 204 No Content if no notifications found', async function() {
            const query = {
                page: 1,
                limit: 10,
                notification_type: 'nonexistent'
            };
            const res = await request().get('/notifications/').query(query);
            expect(res).to.have.status(204);
        });
    });

    // GET /notifications/count
    describe('GET /notifications/count', function() {
        it('should return the count of notifications', async function() {
            const res = await request().get('/notifications/count');
            expect(res).to.have.status(200);
            expect(res.body).to.be.a('number');
        });
    });

    // GET /notifications/types
    describe('GET /notifications/types', function() {
        it('should return a list of notification types', async function() {
            const query = {
                page: 1,
                limit: 10
            };
            const res = await request().get('/notifications/types').query(query);
            expect(res).to.have.status(200);
            expect(res.body).to.be.an('object');
            expect(res.body).to.have.property('data').and.to.be.an('array');
        });
    });
});
