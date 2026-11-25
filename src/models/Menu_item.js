'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Menu_item extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Menu_item.hasMany(models.Order, {
        foreignKey: 'order_items_id'
      });
    }
  }
  Menu_item.init({
    name: DataTypes.STRING,
    category: DataTypes.STRING,
    ingredients: DataTypes.STRING,
    price: DataTypes.FLOAT,
    description: DataTypes.STRING,
    quantity: DataTypes.INTEGER,
    stock: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Menu_item',
    tableName: 'menu_items'
  });
  return Menu_item;
};