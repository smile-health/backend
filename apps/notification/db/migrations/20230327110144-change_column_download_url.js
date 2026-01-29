'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Ubah tipe data kolom dari string ke text
    await queryInterface.changeColumn('notifications', 'download_url', {
      type: Sequelize.TEXT
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Kembalikan tipe data kolom ke string
    await queryInterface.changeColumn('notifications', 'download_url', {
      type: Sequelize.STRING
    });
  }
};
