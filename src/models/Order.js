'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Order.belongsTo(models.Customer, {
        foreignKey: 'customer_id',
    
      });
      Order.belongsTo(models.Menu_item, {
        foreignKey: 'order_items_id'
      });
    }
  }
  Order.init({
    customer_id: DataTypes.INTEGER,
    order_date: DataTypes.DATE,
    order_items_id: DataTypes.INTEGER,
    total_amount: DataTypes.FLOAT,
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Em preparo'
    }
  }, {
    sequelize,
    modelName: 'Order',
    tableName: 'orders'
  });
  return Order;
};