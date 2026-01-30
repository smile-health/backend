'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.addColumn(
      'http_logs',
      'retry_status',
      {
        type: Sequelize.DataTypes.STRING,
      }
    );
    await queryInterface.addIndex(
      'http_logs',
      ['worker_name', 'res_status']
    );
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeColumn('http_logs', 'retry_status')
    await queryInterface.removeIndex(
      'http_logs',
      ['worker_name', 'res_status']
    )
  }
};
