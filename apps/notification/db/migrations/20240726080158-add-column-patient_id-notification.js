'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    const notification = await queryInterface.describeTable('notifications')

    if(!notification.patient_id)
      await queryInterface.addColumn(
        'notifications',
        'patient_id',
        {
          type: Sequelize.BIGINT,
          allowNull: true
        }
      )
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeColumn('notifications', 'patient_id')
  }
};
