'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Ubah tipe data kolom dari string ke text
    await queryInterface.changeColumn('notifications', 'province_id', {
      allowNull: true,
      type: Sequelize.INTEGER
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Kembalikan tipe data kolom ke string
    await queryInterface.changeColumn('notifications', 'province_id', {
      allowNull: false,
      type: Sequelize.INTEGER
    });
  }
};
