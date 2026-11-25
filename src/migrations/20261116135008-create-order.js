'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('orders', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      customer_id:{
        allowNull: true,
        type: Sequelize.INTEGER,
        references:{model:'customers', key:'id'
        }
      },
      order_date: {
        allowNull: false,
        type: Sequelize.DATE
      },
      order_items_id: {
        allowNull: true,
        type: Sequelize.INTEGER,
        references: { model: 'menu_items', key: 'id' }
      },
      total_amount: {
        allowNull: false,
        type: Sequelize.FLOAT
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('orders');
  }
};