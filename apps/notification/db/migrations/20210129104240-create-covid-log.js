'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('covid_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      order_id: {
        type: Sequelize.BIGINT
      },
      url: {
        type: Sequelize.TEXT
      },
      worker_name: {
        type: Sequelize.STRING
      },
      payload: {
        type: Sequelize.TEXT
      },
      res_body: {
        type: Sequelize.TEXT
      },
      res_status: {
        type: Sequelize.INTEGER
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
    await queryInterface.dropTable('covid_logs');
  }
};