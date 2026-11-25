'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('orders');
    if (!tableDesc.status) {
      await queryInterface.addColumn('orders', 'status', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Em preparo',
      });
    }
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable('orders');
    if (tableDesc.status) {
      await queryInterface.removeColumn('orders', 'status');
    }
  },
};
