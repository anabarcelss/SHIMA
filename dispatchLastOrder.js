#!/usr/bin/env node
// Utilitário CLI executável para simular a liberação pelo admin de um pedido para entrega e notificar no WhatsApp

const [rawPhoneArg = '', optionalOrderIdArg = ''] = process.argv.slice(2);
const rawPhone = rawPhoneArg.trim();
const numericDigits = rawPhone.replace(/\D/g, '');
const optionalOrderId = optionalOrderIdArg.trim();

if (!rawPhone || numericDigits.length < 10) {
    console.error('Uso: node dispatchLastOrder.js <numero_whatsapp> [order_id]');
    console.error('Exemplo (último pedido pendente): node dispatchLastOrder.js 27988460599');
    console.error('Exemplo (pedido específico): node dispatchLastOrder.js 27988460599 24');
    process.exit(1);
}

const dataSource = require('./src/models');
const {
    dispatchOrderForDelivery,
    dispatchLastCustomerOrder,
    waitUntilBotReady,
    disconnectBot,
} = require('./src/cfg/whatsappWeb.js');

async function main() {
    try {
        await waitUntilBotReady(60000);

        const result = optionalOrderId
            ? await dispatchOrderForDelivery(optionalOrderId, {
                  adminRole: 'admin',
                  phone: rawPhone,
              })
            : await dispatchLastCustomerOrder(rawPhone, {
                  adminRole: 'admin',
              });

        console.log(
            `\nPedido #${result.orderId} liberado para entrega (status: ${result.status}) e enviado para ${result.chatId}!`
        );
        console.log('--- Mensagem enviada ---');
        console.log(result.message);
    } finally {
        await disconnectBot().catch(() => {});
        await dataSource.sequelize.close().catch(() => {});
    }
}

main().catch((error) => {
    console.error('Erro ao liberar pedido para entrega via WhatsApp:', error.message || error);
    process.exit(1);
});
