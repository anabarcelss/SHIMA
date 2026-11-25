#!/usr/bin/env node
// Utilitário CLI executável para sortear um ID de pedido real no banco e enviá-lo no WhatsApp

const rawPhone = process.argv.slice(2).join(' ').trim();
const numericDigits = rawPhone.replace(/\D/g, '');

if (!rawPhone || numericDigits.length < 10) {
    console.error('Uso: node sendRandomOrder.js <numero_whatsapp>');
    console.error('Exemplo: node sendRandomOrder.js 27988460599');
    process.exit(1);
}

const dataSource = require('./src/models');
const {
    sendRandomCustomerOrder,
    waitUntilBotReady,
    disconnectBot,
} = require('./src/cfg/whatsappWeb.js');

async function main() {
    try {
        await waitUntilBotReady(60000);
        const result = await sendRandomCustomerOrder(rawPhone);

        console.log(`\nPedido aleatório #${result.orderId} (do banco) enviado para ${result.chatId}!`);
        console.log('--- Mensagem enviada ---');
        console.log(result.message);
    } finally {
        await disconnectBot().catch(() => {});
        await dataSource.sequelize.close().catch(() => {});
    }
}

main().catch((error) => {
    console.error('Erro ao enviar pedido aleatório via WhatsApp:', error.message || error);
    process.exit(1);
});
