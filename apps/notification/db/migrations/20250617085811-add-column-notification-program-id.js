'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    const notification = await queryInterface.describeTable('notifications')

    if (!notification.program_id)
      await queryInterface.addColumn('notifications', 'program_id', {
        type: Sequelize.BIGINT,
        allowNull: true,
      })
  },

  async down(queryInterface) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeColumn('notifications', 'program_id')
  },
}
