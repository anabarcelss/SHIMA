'use strict';

module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.models.Customer || require('./Customer.js')(sequelize, DataTypes);

  // Classe Admin estende Customer com role 'admin' e permissões irrestritas
  class Admin extends Customer {
    static associate(models) {
      Admin.hasMany(models.Order, {
        foreignKey: 'customer_id',
        as: 'customerOrders'
      });
    }

    get unrestrictedPermissions() {
      return this.role === 'admin';
    }

    hasUnrestrictedPermissions() {
      return this.role === 'admin';
    }
  }

  Admin.init({
    ...Customer.getAttributes(),
    role: {
      type: DataTypes.STRING,
      defaultValue: 'admin'
    }
  }, {
    sequelize,
    modelName: 'Admin',
    tableName: 'customers',
    defaultScope: {
      where: { role: 'admin' }
    }
  });

  return Admin;
};
