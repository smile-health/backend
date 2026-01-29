'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
     await queryInterface.createTable('bpom_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      url: {
        type: Sequelize.STRING,
      },
      payload: {
        type: Sequelize.TEXT,
      },
      customer_id: {
        type: Sequelize.INTEGER,
      },
      vendor_id : {
        type: Sequelize.INTEGER,
      },
      entity_id : {
        type: Sequelize.INTEGER,
      },
      order_id: {
        type: Sequelize.BIGINT,
      },
      transaction_id: {
        allowNull: true,
        type: Sequelize.BIGINT
      },
      transaction_type_id: {
        allowNull: true,
        type: Sequelize.INTEGER
      },
      response: {
        allowNull: true,
        type: Sequelize.TEXT
      },
      response_code: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
    });
    await queryInterface.addIndex('bpom_logs', ['url'])
    await queryInterface.addIndex('bpom_logs', ['transaction_id'])
    await queryInterface.addIndex('bpom_logs', ['order_id'])
    await queryInterface.addIndex('bpom_logs', ['entity_id'])
    await queryInterface.addIndex('bpom_logs', ['vendor_id'])
    await queryInterface.addIndex('bpom_logs', ['customer_id'])
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('bpom_logs');
  }
};
