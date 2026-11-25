'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkInsert(
      'menu_items',
      [
        {
          name: 'Combo Shimã Prime (40 peças)',
          category: 'Combinados',
          ingredients: '10 Sashimis de Salmão, 10 Uramakis Filadélfia, 10 Hossomakis de Salmão, 10 Hot Rolls',
          price: 189.90,
          description: 'Combinado completo perfeito para compartilhar. Salmão fresco selecionado e rolls crocantes.',
          quantity: 40,
          stock: 30,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Combo Individual Shimã (16 peças)',
          category: 'Combinados',
          ingredients: '4 Sashimis de Salmão, 4 Uramakis Filadélfia, 4 Niguiris de Salmão, 4 Hot Rolls',
          price: 68.90,
          description: 'A seleção ideal para uma refeição individual saborosa e equilibrada.',
          quantity: 16,
          stock: 45,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Combo Hot Roll Variado (20 peças)',
          category: 'Combinados',
          ingredients: '10 Hot Roll Salmão Filadélfia, 10 Hot Roll Tartar com Tarê e Couve Crispy',
          price: 74.90,
          description: 'Para os amantes de hot roll: empanados crocantes por fora, cremosos por dentro.',
          quantity: 20,
          stock: 35,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Sashimi Salmão Maçaricado (10 fatias)',
          category: 'Sashimi',
          ingredients: 'Fatias de salmão fresco maçaricado, azeite trufado, flor de sal, cebolinha e gergelim',
          price: 54.90,
          description: 'Salmão levemente maçaricado com toque trufado especial da casa.',
          quantity: 10,
          stock: 40,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Sashimi Salmão Tradicional (10 fatias)',
          category: 'Sashimi',
          ingredients: 'Fatias nobres de salmão fresco cortadas na espessura clássica japonesa',
          price: 49.90,
          description: 'Cortes frescos e nobres de salmão cru de altíssima qualidade.',
          quantity: 10,
          stock: 50,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Sashimi Atum Fresco (10 fatias)',
          category: 'Sashimi',
          ingredients: 'Fatias nobres de atum fresco, gergelim torrado e lâminas de limão',
          price: 52.90,
          description: 'Atum vermelho fresco selecionado, sabor marcante e textura aveludada.',
          quantity: 10,
          stock: 25,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Temaki Filadélfia Completo',
          category: 'Temaki',
          ingredients: 'Arroz shari, alga nori crocante, salmão fresco em cubos, cream cheese e cebolinha',
          price: 36.90,
          description: 'O clássico temaki generosamente recheado com salmão fresco e cream cheese.',
          quantity: 1,
          stock: 60,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Temaki Salmão Grelhado Crocante',
          category: 'Temaki',
          ingredients: 'Salmão grelhado temperado, cream cheese, molho tarê, cebolinha e gergelim',
          price: 38.90,
          description: 'Recheio suculento de salmão grelhado e molho tarê artesanal.',
          quantity: 1,
          stock: 40,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Temaki Hot Shimã',
          category: 'Temaki',
          ingredients: 'Temaki empanado na farinha panko e frito, salmão, cream cheese, tarê e cebolinha',
          price: 41.90,
          description: 'Temaki totalmente empanado e frito na hora, crocante por fora e cremoso por dentro.',
          quantity: 1,
          stock: 30,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Uramaki Filadélfia Especial (8 peças)',
          category: 'Uramaki',
          ingredients: 'Arroz shari invertido, nori, salmão fresco, cream cheese e gergelim tostado',
          price: 32.90,
          description: 'O enrolado invertido mais tradicional, suave e com gergelim crocante.',
          quantity: 8,
          stock: 50,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Uramaki Ebi Spicy (8 peças)',
          category: 'Uramaki',
          ingredients: 'Camarão empanado crocante, cream cheese, maionese spicy e lâminas de abacate',
          price: 39.90,
          description: 'Camarão crocante por dentro, finalizado com um leve toque picante oriental.',
          quantity: 8,
          stock: 30,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Hossomaki Shakemaki Salmão (8 peças)',
          category: 'Hossomaki',
          ingredients: 'Arroz shari, nori crocante e tiras de salmão fresco',
          price: 26.90,
          description: 'Enrolado fino clássico com alga por fora e salmão fresco no centro.',
          quantity: 8,
          stock: 45,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Niguiri Salmão Trufado (4 peças)',
          category: 'Niguiri',
          ingredients: 'Bolinho de arroz shari, fatia de salmão maçaricado, azeite trufado e flor de sal',
          price: 34.90,
          description: 'Salmão levemente maçaricado com aroma marcante de azeite trufado e flor de sal.',
          quantity: 4,
          stock: 35,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Niguiri Skin Especial (4 peças)',
          category: 'Niguiri',
          ingredients: 'Pele de salmão grelhada crocante sobre arroz shari, molho tarê e limão',
          price: 24.90,
          description: 'Pele de salmão crocante com molho tarê artesanal e um toque cítrico.',
          quantity: 4,
          stock: 35,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Guioza Suína Artesanal (6 unidades)',
          category: 'Entrada',
          ingredients: 'Massa fina recheada com carne suína temperada, acelga e gengibre, grelhada',
          price: 29.90,
          description: 'Pasteizinhos orientais no vapor e dourados na chapa, servidos com molho ponzu.',
          quantity: 6,
          stock: 40,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Hot Roll Filadélfia com Couve Crispy (10 peças)',
          category: 'Hot Roll',
          ingredients: 'Rolinho empanado e frito com salmão e cream cheese, coberto com couve crispy e tarê',
          price: 39.90,
          description: 'Nosso hot roll mais pedido, coberto com couve crocante sequinha e molho tarê.',
          quantity: 10,
          stock: 65,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Sunomono Especial com Salmão',
          category: 'Entrada',
          ingredients: 'Lâminas finas de pepino japonês em conserva agridoce, gergelim e cubos de salmão',
          price: 27.90,
          description: 'Salada refrescante agridoce tradicional japonesa finalizada com cubos de salmão.',
          quantity: 1,
          stock: 50,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Yakisoba Especial Misto (Carne e Frango)',
          category: 'Prato Quente',
          ingredients: 'Macarrão tradicional, tiras de alcatra, peito de frango, legumes frescos e molho oriental',
          price: 56.90,
          description: 'Prato quente clássico e reconfortante com legumes frescos e molho encorpado.',
          quantity: 1,
          stock: 30,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Harumaki Doce de Nutella com Morango (2 unidades)',
          category: 'Sobremesa',
          ingredients: 'Massa fina crocante de rolinho primavera recheada com Nutella e morangos frescos',
          price: 28.90,
          description: 'Rolinho doce quentinho, crocante e muito recheado.',
          quantity: 2,
          stock: 40,
          createdAt: now,
          updatedAt: now
        },
        {
          name: 'Refrigerante Coca-Cola Lata 350ml',
          category: 'Bebidas',
          ingredients: 'Água gaseificada, açúcar, extrato de noz de cola, cafeína',
          price: 7.50,
          description: 'Lata 350ml estupidamente gelada.',
          quantity: 1,
          stock: 120,
          createdAt: now,
          updatedAt: now
        }
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('menu_items', null, {});
  }
};

