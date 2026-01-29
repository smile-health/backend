'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable('notifications', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      message: {
        type: Sequelize.TEXT
      },
      user_id: {
        allowNull: false,
        type: Sequelize.BIGINT,
      },
      province_id : {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      regency_id : {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      entity_id: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      media: {
        allowNull: false,
        type: Sequelize.STRING
      },
      title: {
        allowNull: true,
        type: Sequelize.STRING
      },
      type: {
        allowNull: false,
        type: Sequelize.STRING
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      read_at: {
        allowNull: true,
        type: Sequelize.DATE
      },
      mobile_phone: {
        allowNull: true,
        type: Sequelize.STRING
      },
      action_url: {
        allowNull: true,
        type: Sequelize.STRING
      }
    });
    await queryInterface.addIndex('notifications', ['user_id'])
    await queryInterface.addIndex('notifications', ['province_id'])
    await queryInterface.addIndex('notifications', ['regency_id'])
    await queryInterface.addIndex('notifications', ['entity_id'])
    await queryInterface.addIndex('notifications', ['type'])
    await queryInterface.addIndex('notifications', ['created_at'])
    await queryInterface.addIndex('notifications', ['read_at'])
  },

  down: async (queryInterface, Sequelize) => {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('notifications');
  }
};
