'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Dynamically retrieve existing customers to ensure referential integrity
    const [customers] = await queryInterface.sequelize.query(
      'SELECT id, name, createdAt FROM customers ORDER BY id ASC'
    );

    if (!customers || customers.length === 0) {
      throw new Error('No customers found in database. Seed customers first before seeding orders.');
    }

    // Dynamically retrieve existing menu items to ensure referential integrity
    const [menuItems] = await queryInterface.sequelize.query(
      'SELECT id, name, price FROM menu_items ORDER BY id ASC'
    );

    if (!menuItems || menuItems.length === 0) {
      throw new Error('No menu items found in database. Seed menu items first before seeding orders.');
    }

    const orders = [];
    const baseDate = new Date(); // Current date

    // Distribute orders across customers simulating real-world sushi delivery frequency:
    // Frequent customers order multiple times; occasional customers order once or twice.
    customers.forEach((customer, index) => {
      // Customer profile:
      // index % 5 === 0 -> VIP / Frequent customer (3 to 4 orders)
      // index % 2 === 0 -> Regular customer (2 orders)
      // Others -> Single order
      let orderCount = 1;
      if (index % 5 === 0) {
        orderCount = 4;
      } else if (index % 2 === 0) {
        orderCount = 2;
      }

      for (let i = 0; i < orderCount; i++) {
        // Spread orders over the past 14 days
        const daysAgo = (index * 2 + i * 3) % 14;
        const orderDate = new Date(baseDate);
        orderDate.setDate(baseDate.getDate() - daysAgo);

        // Typical restaurant delivery peak hours:
        // Lunch: 12:00 - 14:00 | Dinner: 19:00 - 22:30
        const isDinner = (index + i) % 3 !== 0;
        const hour = isDinner ? 19 + ((index + i) % 4) : 12 + ((index + i) % 2);
        const minute = (index * 7 + i * 13) % 60;
        orderDate.setHours(hour, minute, 0, 0);

        const menuItemIndex = (index * 3 + i * 5) % menuItems.length;
        const menuItem = menuItems[menuItemIndex];

        orders.push({
          customer_id: customer.id,
          order_date: orderDate,
          order_items_id: menuItem.id,
          total_amount: Number(menuItem.price),
          createdAt: orderDate,
          updatedAt: orderDate
        });
      }
    });

    // Sort chronologically by order_date
    orders.sort((a, b) => a.order_date - b.order_date);

    await queryInterface.bulkInsert('orders', orders, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('orders', null, {});
  }
};

