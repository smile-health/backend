'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable('whatsapp_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      worker_name: {
        type: Sequelize.STRING
      },
      url: {
        type: Sequelize.TEXT
      },
      request_body: {
        type: Sequelize.TEXT
      },
      response_body: {
        type: Sequelize.TEXT
      },
      response_status_code: {
        type: Sequelize.INTEGER
      },
      response_status_text: {
        type: Sequelize.STRING
      },
      method: {
        type: Sequelize.STRING
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('whatsapp_logs');
  }
};
