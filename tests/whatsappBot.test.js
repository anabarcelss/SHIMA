const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const Module = require('node:module');

const dataSource = require('../src/models');
const { EncryptPassword } = require('../src/cfg/bcryptHash.js');

const mockWhatsAppState = {
    getNumberIdCalls: [],
    sendMessageCalls: [],
    numberExists: true,
    resolvedJidSuffix: '@lid',
};

// Intercepta whatsapp-web.js e puppeteer antes de carregar whatsappWeb.js
// para evitar qualquer conexão ao navegador ativo via DevToolsActivePort
const origLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'puppeteer') {
        return {
            connect: async () => {
                throw new Error('Mock: não anexar ao navegador real durante os testes');
            },
        };
    }

    if (request === 'whatsapp-web.js') {
        class MockClient extends EventEmitter {
            constructor() {
                super();
                this.info = null;
                this.pupPage = null;
                this.pupBrowser = null;
            }

            async initialize() {
                this.info = { wid: { _serialized: '5527999999999@c.us' } };
                this.pupPage = {};
                this.emit('ready');
            }

            async destroy() {
                this.info = null;
                this.pupPage = null;
            }

            async getNumberId(digits) {
                mockWhatsAppState.getNumberIdCalls.push(digits);
                if (!mockWhatsAppState.numberExists) return null;
                const serialized =
                    mockWhatsAppState.resolvedJidSuffix === '@lid'
                        ? '2310776348749@lid'
                        : `${digits}@c.us`;
                return { _serialized: serialized };
            }

            async sendMessage(chatId, text, options = {}) {
                mockWhatsAppState.sendMessageCalls.push({ chatId, text, options });
                return { id: { _serialized: `mock-${mockWhatsAppState.sendMessageCalls.length}` }, body: text };
            }
        }

        class MockLocalAuth {}
        return { Client: MockClient, LocalAuth: MockLocalAuth };
    }

    return origLoad.apply(this, arguments);
};

const {
    bot,
    sendCustomerOrder,
    sendRandomCustomerOrder,
    dispatchOrderForDelivery,
    dispatchLastCustomerOrder,
    sendTextMessage,
    formatOrderMessage,
    formatDispatchMessage,
    waitUntilBotReady,
    disconnectBot,
} = require('../src/cfg/whatsappWeb.js');

describe('Bateria de Testes — Bot do WhatsApp (whatsappWeb.js)', () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    let testCustomerId;
    let testMenuItemId;
    let firstOrderId;
    let secondOrderId;

    before(async () => {
        await dataSource.sequelize.authenticate();
        await waitUntilBotReady(5000);

        const hashedPw = await EncryptPassword('TesteBot123!');
        const customer = await dataSource.Customer.create({
            name: 'Cliente Bot Teste',
            password: hashedPw,
            email: `bot.teste.${uniqueSuffix}@shima.test`,
            address: 'Av. Nossa Senhora da Penha, 500 - Praia do Canto',
            phone: '27988460599',
            role: 'user',
        });
        testCustomerId = customer.id;

        const menuItem = await dataSource.Menu_item.create({
            name: `Temaki Teste Bot ${uniqueSuffix}`,
            category: 'Temaki',
            ingredients: 'Salmão fresco e cream cheese',
            price: 35.0,
            description: 'Item temporário para suíte do bot',
            quantity: 1,
            stock: 50,
        });
        testMenuItemId = menuItem.id;

        // Cria 2 pedidos temporários reais no MySQL (segundo com total_amount = 70.0 para testar inferência 2x)
        const order1 = await dataSource.Order.create({
            customer_id: testCustomerId,
            order_date: new Date('2026-11-25T17:10:00Z'),
            order_items_id: testMenuItemId,
            total_amount: 35.0,
            status: 'Em preparo',
        });
        const order2 = await dataSource.Order.create({
            customer_id: testCustomerId,
            order_date: new Date('2026-11-25T17:20:00Z'),
            order_items_id: testMenuItemId,
            total_amount: 70.0,
            status: 'Em preparo',
        });
        firstOrderId = order1.id;
        secondOrderId = order2.id;
    });

    beforeEach(() => {
        mockWhatsAppState.getNumberIdCalls.length = 0;
        mockWhatsAppState.sendMessageCalls.length = 0;
        mockWhatsAppState.numberExists = true;
        mockWhatsAppState.resolvedJidSuffix = '@lid';
        bot.info = { wid: { _serialized: '5527999999999@c.us' } };
        bot.pupPage = {};
    });

    after(async () => {
        const orderIds = [firstOrderId, secondOrderId].filter(Boolean);
        if (orderIds.length > 0) {
            await dataSource.Order.destroy({ where: { id: orderIds } });
        }
        if (testMenuItemId) {
            await dataSource.Menu_item.destroy({ where: { id: testMenuItemId } });
        }
        if (testCustomerId) {
            await dataSource.Customer.destroy({ where: { id: testCustomerId } });
        }
        await disconnectBot().catch(() => {});
        await dataSource.sequelize.close();
    });

    describe('1. Formatação de mensagens (formatOrderMessage e formatDispatchMessage)', () => {
        it('formatOrderMessage deve incluir os 9 campos, inferir quantidade, formatar telefone e entrega grátis', () => {
            const sampleOrder = {
                id: 77,
                order_date: new Date('2026-11-25T17:10:00Z'),
                total_amount: 70.0,
                Customer: {
                    name: 'Maria Clara',
                    phone: '27988460599',
                    address: 'Rua das Palmeiras, 300 - Centro',
                },
                Menu_item: {
                    name: 'Temaki Salmão',
                    price: 35.0,
                },
            };

            const freeDeliveryMsg = formatOrderMessage(sampleOrder, {
                addressNumber: 'Apto 101',
                estimatedTime: 35,
                deliveryFee: 0,
            });

            for (const expected of [
                '🍣 *Shimã Sushi — Confirmação de Pedido*',
                '#77',
                'Maria Clara',
                '(27) 98846-0599',
                'Rua das Palmeiras, 300 - Centro, Nº Apto 101',
                '2x Temaki Salmão (R$ 35,00)',
                '25/11/2026 às 14:10',
                '35 minutos',
                'R$ 70,00',
                'Grátis (R$ 0,00)',
            ]) {
                assert.ok(freeDeliveryMsg.includes(expected), `Esperava encontrar: ${expected}`);
            }

            const multiItemPaidMsg = formatOrderMessage(sampleOrder, {
                items: [
                    { name: 'Combo Prime', quantity: 1, price: 189.9 },
                    { name: 'Coca-Cola', quantity: 2, price: 7.5 },
                ],
                subtotal: 204.9,
                deliveryFee: 8.9,
                estimatedTime: '45 a 55 minutos',
            });
            assert.ok(multiItemPaidMsg.includes('1x Combo Prime (R$ 189,90)'));
            assert.ok(multiItemPaidMsg.includes('2x Coca-Cola (R$ 7,50)'));
            assert.ok(multiItemPaidMsg.includes('R$ 8,90'));
            assert.ok(multiItemPaidMsg.includes('R$ 213,80'));
        });

        it('formatDispatchMessage deve formatar aviso de saída para entrega com entregador opcional e previsão', () => {
            const sampleOrder = {
                id: 88,
                status: 'Saiu para entrega',
                total_amount: 68.9,
                Customer: {
                    name: 'Juliana Pereira',
                    phone: '27988460599',
                    address: 'Av. Atlântica, 980',
                },
                Menu_item: { name: 'Combo Individual', price: 68.9 },
            };

            const defaultMsg = formatDispatchMessage(sampleOrder);
            assert.ok(defaultMsg.includes('🛵 *Shimã Sushi — Pedido Saiu para Entrega!*'));
            assert.ok(defaultMsg.includes('📌 *Status:* Saiu para entrega'));
            assert.ok(defaultMsg.includes('⏱️ *Previsão de chegada:* 20 a 30 minutos'));
            assert.ok(!defaultMsg.includes('Entregador:'));

            const withCourierMsg = formatDispatchMessage(sampleOrder, {
                courierName: 'Carlos Motoboy',
                estimatedTime: '15 minutos',
            });
            assert.ok(withCourierMsg.includes('🏍️ *Entregador:* Carlos Motoboy'));
            assert.ok(withCourierMsg.includes('⏱️ *Previsão de chegada:* 15 minutos'));
        });
    });

    describe('2. Envio de texto e pedidos (sendTextMessage, sendCustomerOrder, sendRandomCustomerOrder)', () => {
        it('sendTextMessage deve validar texto vazio (400), telefone curto (400), sem WhatsApp (404), bot offline (503) e enviar normalizado', async () => {
            await assert.rejects(
                () => sendTextMessage('27988460599', '   '),
                (err) => err.status === 400
            );

            await assert.rejects(
                () => sendTextMessage('12345', 'Oi'),
                (err) => err.status === 400
            );

            mockWhatsAppState.numberExists = false;
            await assert.rejects(
                () => sendTextMessage('27988460599', 'Teste'),
                (err) => err.status === 404
            );
            mockWhatsAppState.numberExists = true;

            bot.info = null;
            await assert.rejects(
                () => sendTextMessage('27988460599', 'Teste'),
                (err) => err.status === 503
            );
            bot.info = { wid: { _serialized: '5527999999999@c.us' } };
            mockWhatsAppState.getNumberIdCalls.length = 0;

            const res = await sendTextMessage('27988460599', 'Olá do teste!');
            assert.deepEqual(mockWhatsAppState.getNumberIdCalls, ['5527988460599']);
            assert.equal(res.chatId, '2310776348749@lid');
            assert.equal(mockWhatsAppState.sendMessageCalls.length, 1);
            assert.deepEqual(mockWhatsAppState.sendMessageCalls[0].options, { sendSeen: false });
        });

        it('sendCustomerOrder deve validar ID ausente (400), pedido inexistente (404) e buscar pedido real no MySQL', async () => {
            await assert.rejects(
                () => sendCustomerOrder(),
                (err) => err.status === 400
            );

            await assert.rejects(
                () => sendCustomerOrder(999999),
                (err) => err.status === 404
            );

            const res = await sendCustomerOrder(firstOrderId, { deliveryFee: 6.5 });
            assert.equal(res.orderId, firstOrderId);
            assert.ok(res.message.includes(`#${firstOrderId}`));
            assert.ok(res.message.includes('Cliente Bot Teste'));
            assert.ok(res.message.includes(`Temaki Teste Bot ${uniqueSuffix}`));
            assert.ok(res.message.includes('R$ 41,50'));
        });

        it('sendRandomCustomerOrder deve sortear um ID real existente na tabela orders e enviar', async () => {
            const res = await sendRandomCustomerOrder('27988460599');
            assert.ok(typeof res.orderId === 'number' && res.orderId > 0);
            assert.equal(mockWhatsAppState.sendMessageCalls.length, 1);
            assert.ok(res.message.includes(`#${res.orderId}`));
        });
    });

    describe('3. Liberação pelo Admin (dispatchOrderForDelivery e dispatchLastCustomerOrder)', () => {
        it('deve bloquear usuário não-admin com 403 em ambas as funções', async () => {
            await assert.rejects(
                () => dispatchOrderForDelivery(firstOrderId, { adminRole: 'user' }),
                (err) => err.status === 403
            );
            await assert.rejects(
                () => dispatchLastCustomerOrder('27988460599', { adminRole: 'user' }),
                (err) => err.status === 403
            );
        });

        it('se o número não existir no WhatsApp (404), NÃO deve alterar o status do pedido no MySQL', async () => {
            mockWhatsAppState.numberExists = false;
            await assert.rejects(
                () => dispatchOrderForDelivery(firstOrderId, { adminRole: 'admin' }),
                (err) => err.status === 404
            );

            const orderAfterFail = await dataSource.Order.findByPk(firstOrderId);
            assert.equal(orderAfterFail.status, 'Em preparo');
        });

        it('dispatchOrderForDelivery e dispatchLastCustomerOrder devem atualizar status para "Saiu para entrega" e bloquear duplicado', async () => {
            // Despacha o último pedido pendente criado (secondOrderId)
            const lastDispatch = await dispatchLastCustomerOrder('27988460599', {
                adminRole: 'admin',
                courierName: 'Moto Teste',
            });
            assert.equal(lastDispatch.orderId, secondOrderId);
            assert.equal(lastDispatch.status, 'Saiu para entrega');
            assert.ok(lastDispatch.message.includes('🛵 *Shimã Sushi — Pedido Saiu para Entrega!*'));
            assert.ok(lastDispatch.message.includes(`• 2x Temaki Teste Bot ${uniqueSuffix}`));

            const updatedSecond = await dataSource.Order.findByPk(secondOrderId);
            assert.equal(updatedSecond.status, 'Saiu para entrega');

            // Novo despacho no mesmo pedido sem forceResend deve retornar 400
            await assert.rejects(
                () => dispatchOrderForDelivery(secondOrderId, { adminRole: 'admin' }),
                (err) => err.status === 400
            );

            // Com forceResend: true deve permitir reenviar mantendo status
            const forced = await dispatchOrderForDelivery(secondOrderId, {
                adminRole: 'admin',
                forceResend: true,
            });
            assert.equal(forced.status, 'Saiu para entrega');
            assert.equal(mockWhatsAppState.sendMessageCalls.length, 2);
        });
    });

    describe('4. Eventos interativos e waitUntilBotReady', () => {
        it('deve responder 1 vez para mensagem de terceiro, 1 vez para mensagem própria e ignorar loops/status', async () => {
            const replies = [];
            const makeMsg = (overrides) => ({
                fromMe: false,
                isStatus: false,
                from: '5527988460599@c.us',
                to: '5527999999999@c.us',
                body: '!ping',
                reply: async (text, chatId, options) => {
                    replies.push({ text, chatId, options });
                },
                ...overrides,
            });

            // Mensagem recebida de terceiro (Client real emite message_create e message)
            const thirdPartyMsg = makeMsg({ fromMe: false, body: '!ping' });
            bot.emit('message_create', thirdPartyMsg);
            bot.emit('message', thirdPartyMsg);

            // Mensagem enviada pelo próprio número (Client real emite apenas message_create)
            const selfMsg = makeMsg({ fromMe: true, body: 'teste' });
            bot.emit('message_create', selfMsg);

            // Mensagens que devem ser ignoradas (status, texto comum e respostas do bot)
            bot.emit('message', makeMsg({ from: 'status@broadcast', body: '!ping' }));
            bot.emit('message', makeMsg({ isStatus: true, body: '!ping' }));
            bot.emit('message', makeMsg({ body: 'bom dia' }));
            bot.emit(
                'message_create',
                makeMsg({
                    fromMe: true,
                    body: '🍣 Olá! Bot do Shimã Sushi online e funcionando!',
                })
            );
            bot.emit(
                'message_create',
                makeMsg({
                    fromMe: true,
                    body: '🍣 *Shimã Sushi — Confirmação de Pedido*\n...',
                })
            );
            bot.emit(
                'message_create',
                makeMsg({
                    fromMe: true,
                    body: '🛵 *Shimã Sushi — Pedido Saiu para Entrega!*\n...',
                })
            );

            await new Promise((resolve) => setTimeout(resolve, 40));

            assert.equal(replies.length, 2);
            assert.deepEqual(replies[0].options, {});
            assert.deepEqual(replies[1].options, { sendSeen: false });
        });

        it('waitUntilBotReady deve resolver quando pronto, rejeitar 504 em timeout e 401 em auth_failure', async () => {
            await waitUntilBotReady(500);

            try {
                bot.emit('disconnected', 'TESTE_TIMEOUT');
                bot.info = null;
                await assert.rejects(
                    () => waitUntilBotReady(50),
                    (err) => err.status === 504
                );

                const authPromise = waitUntilBotReady(500);
                bot.emit('auth_failure', 'Sessão expirada');
                await assert.rejects(authPromise, (err) => err.status === 401);
            } finally {
                bot.info = { wid: { _serialized: '5527999999999@c.us' } };
                bot.pupPage = {};
                bot.emit('ready');
            }
        });
    });
});
