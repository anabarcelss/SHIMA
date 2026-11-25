'use strict';

const { EncryptPassword } = require('../cfg/bcryptHash.js');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    // Criptografa a senha padrão da seed para compatibilidade com ComparePassword no login
    const hashedPassword = await EncryptPassword('123456');
    const guilhermePassword = await EncryptPassword('guigui123');
    await queryInterface.bulkInsert(
      'customers',
      [
        {
          name: 'Lucas Silva',
          password: hashedPassword,
          email: 'lucas.silva@email.com',
          address: 'Rua das Flores, 120 - Centro',
          phone: '11987654321',
          role: 'user',
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Mariana Oliveira',
          password: hashedPassword,
          email: 'mariana.oliveira@email.com',
          address: 'Avenida Paulista, 1500, Apto 402 - Bela Vista',
          phone: '11991234567',
          role: 'user',
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Gabriel Santos',
          password: hashedPassword,
          email: 'gabriel.santos@email.com',
          address: 'Rua Sete de Setembro, 45 - Copacabana',
          phone: '21988776655',
          role: 'user',
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Beatriz Souza',
          password: hashedPassword,
          email: 'beatriz.souza@email.com',
          address: 'Alameda dos Pinheiros, 890 - Pinheiros',
          phone: '11976543210',
          role: 'user',
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Rafael Rodrigues',
          password: hashedPassword,
          email: 'rafael.rodrigues@email.com',
          address: 'Avenida Brasil, 2100 - Savassi',
          phone: '31984561230',
          role: 'user',
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Camila Ferreira',
          password: hashedPassword,
          email: 'camila.ferreira@email.com',
          address: 'Rua XV de Novembro, 310, Apto 12 - Centro',
          phone: '41992345678',
          role: 'user',
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Guilherme',
          password: guilhermePassword,
          email: 'guilherme.m4ta@gmail.com',
          address: 'Rua São Sebastião, 450 - Resistência, Vitória',
          phone: '11998761234',
          role: 'admin',
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Juliana Pereira',
          password: hashedPassword,
          email: 'juliana.pereira@email.com',
          address: 'Avenida Atlântica, 980 - Copacabana',
          phone: '21993456789',
          role: 'user',
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Mateus Lima',
          password: hashedPassword,
          email: 'mateus.lima@email.com',
          address: 'Rua Bela Cintra, 555 - Consolação',
          phone: '11981112233',
          role: 'user',
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Fernanda Gomes',
          password: hashedPassword,
          email: 'fernanda.gomes@email.com',
          address: 'Praça da Liberdade, 88 - Funcionários',
          phone: '31995554433',
          role: 'user',
          createdAt: now,
          updatedAt: now
        }
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('customers', null, {});
  }
};
