'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */

    
    queryInterface.sequelize.query(`
    CREATE EVENT IF NOT EXISTS Delete_Fcm_Log_Older_Than_Yesterday
      ON SCHEDULE EVERY 1 DAY
      STARTS STR_TO_DATE(DATE_FORMAT(NOW(),'%Y%m%d 0100'),'%Y%m%d %H%i')
    DO
      DELETE FROM fcm_logs WHERE created_at < DATE_SUB(NOW(),INTERVAL 1 DAY)`)
  },

  async down(queryInterface) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */

    queryInterface.sequelize.query('DROP EVENT IF EXISTS Delete_Fcm_Log_Older_Than_Yesterday')
  }
};
