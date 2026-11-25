const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const EventEmitter = require('node:events');
const Module = require('node:module');

const dataSource = require('../src/models');
const CustomerServices = require('../src/services/CustomerServices.js');
const OrderServices = require('../src/services/OrderServices.js');
const { EncryptPassword } = require('../src/cfg/bcryptHash.js');
const BaseError = require('../src/errors/BaseError.js');
const NotFound = require('../src/errors/NotFound.js');
const RequisicaoIncorreta = require('../src/errors/RequisicaoIncorreta.js');

const rootDir = path.resolve(__dirname, '..');

const mockState = {
    getNumberIdCalls: [],
    sendMessageCalls: [],
    numberExists: true,
};

// Isola puppeteer e whatsapp-web.js antes de carregar whatsappWeb.js
const origLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'puppeteer') {
        return {
            connect: async () => {
                throw new Error('Mock: não anexar ao navegador real em testes de regressão');
            },
        };
    }

    if (request === 'whatsapp-web.js') {
        class MockLocalAuth {
            constructor(opts = {}) {
                this.clientId = opts.clientId;
                this.dataPath = path.resolve(opts.dataPath || './.wwebjs_auth/');
            }
        }

        class MockClient extends EventEmitter {
            constructor(options = {}) {
                super();
                this.options = options;
                this.authStrategy = options.authStrategy;
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
                mockState.getNumberIdCalls.push(digits);
                if (!mockState.numberExists) return null;
                return { _serialized: '2310776348749@lid' };
            }

            async sendMessage(chatId, text, options = {}) {
                mockState.sendMessageCalls.push({ chatId, text, options });
                return { id: { _serialized: `reg-msg-${mockState.sendMessageCalls.length}` }, body: text };
            }
        }

        return { Client: MockClient, LocalAuth: MockLocalAuth };
    }

    return origLoad.apply(this, arguments);
};

const {
    bot,
    sendCustomerOrder,
    sendRandomCustomerOrder,
    dispatchOrderForDelivery,
    sendTextMessage,
    waitUntilBotReady,
    disconnectBot,
} = require('../src/cfg/whatsappWeb.js');

describe('Suíte de Não-Regressão — Estado Atual e Bugs Corrigidos', () => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const customerServices = new CustomerServices();
    const orderServices = new OrderServices();

    let tempCustomerId;
    let tempMenuItemId;
    let tempOrder1Id;
    let tempOrder2Id;

    before(async () => {
        await dataSource.sequelize.authenticate();
        await waitUntilBotReady(5000);

        const hashedPw = await EncryptPassword('Regressao123!');
        const customer = await dataSource.Customer.create({
            name: 'Cliente Regressão',
            password: hashedPw,
            email: `reg.${uniqueSuffix}@shima.test`,
            address: 'Rua da Regressão, 10 - Centro',
            phone: '27988460599',
            role: 'user',
        });
        tempCustomerId = customer.id;

        const menuItem = await dataSource.Menu_item.create({
            name: `Combinado Regressão ${uniqueSuffix}`,
            category: 'Combinados',
            ingredients: 'Salmão fresco',
            price: 49.9,
            description: 'Item temporário de não-regressão',
            quantity: 10,
            stock: 20,
        });
        tempMenuItemId = menuItem.id;

        const order1 = await dataSource.Order.create({
            customer_id: tempCustomerId,
            order_date: new Date('2026-11-25T18:00:00Z'),
            order_items_id: tempMenuItemId,
            total_amount: 49.9,
            status: 'Em preparo',
        });
        const order2 = await dataSource.Order.create({
            customer_id: tempCustomerId,
            order_date: new Date('2026-11-25T18:05:00Z'),
            order_items_id: tempMenuItemId,
            total_amount: 99.8,
            status: 'Em preparo',
        });
        tempOrder1Id = order1.id;
        tempOrder2Id = order2.id;
    });

    beforeEach(() => {
        mockState.getNumberIdCalls.length = 0;
        mockState.sendMessageCalls.length = 0;
        mockState.numberExists = true;
        bot.info = { wid: { _serialized: '5527999999999@c.us' } };
        bot.pupPage = {};
    });

    after(async () => {
        const orderIds = [tempOrder1Id, tempOrder2Id].filter(Boolean);
        if (orderIds.length > 0) {
            await dataSource.Order.destroy({ where: { id: orderIds } });
        }
        if (tempMenuItemId) {
            await dataSource.Menu_item.destroy({ where: { id: tempMenuItemId } });
        }
        if (tempCustomerId) {
            await dataSource.Customer.destroy({ where: { id: tempCustomerId } });
        }
        await disconnectBot().catch(() => {});
        await dataSource.sequelize.close();
    });

    it('REG-001: whatsapp-web.js deve usar fork github:wwebjs/whatsapp-web.js com WAWebBackendEventBus (correção /login/)', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
        assert.equal(pkg.dependencies['whatsapp-web.js'], 'github:wwebjs/whatsapp-web.js');
        assert.equal(pkg.allowScripts['whatsapp-web.js@1.34.8'], false);

        const clientPath = path.join(rootDir, 'node_modules/whatsapp-web.js/src/Client.js');
        const clientSource = fs.readFileSync(clientPath, 'utf8');
        assert.ok(
            clientSource.includes('WAWebBackendEventBus'),
            'Client.js deve conter suporte a WAWebBackendEventBus para evitar timeout em /login/'
        );
    });

    it('REG-002: sessão/cache fora de src/, .gitignore atualizado e userAgent sem HeadlessChrome', () => {
        const gitignore = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
        assert.ok(gitignore.includes('.env'));
        assert.ok(gitignore.includes('.wwebjs_auth/'));
        assert.ok(gitignore.includes('.wwebjs_cache/'));

        assert.equal(
            fs.existsSync(path.join(rootDir, 'src/cfg/session-shima')),
            false,
            'src/cfg/session-shima não deve existir dentro de src/'
        );

        assert.equal(typeof bot.options.userAgent, 'string');
        assert.ok(bot.options.userAgent.length > 0);
        assert.ok(!bot.options.userAgent.includes('HeadlessChrome'));
        assert.ok(!bot.options.userAgent.includes('Chrome/101'));

        assert.equal(bot.authStrategy.clientId, 'shima');
        assert.equal(bot.authStrategy.dataPath, path.join(rootDir, '.wwebjs_auth'));
    });

    it('REG-003: eventos message e message_create devem responder auto-mensagem sem duplicata nem loop', async () => {
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

        const incoming = makeMsg({ fromMe: false, body: '!ping' });
        bot.emit('message_create', incoming);
        bot.emit('message', incoming);

        const selfMsg = makeMsg({ fromMe: true, body: 'teste' });
        bot.emit('message_create', selfMsg);

        bot.emit('message', makeMsg({ from: 'status@broadcast', body: '!ping' }));
        bot.emit(
            'message_create',
            makeMsg({ fromMe: true, body: '🍣 Olá! Bot do Shimã Sushi online e funcionando!' })
        );
        bot.emit(
            'message_create',
            makeMsg({ fromMe: true, body: '🍣 *Shimã Sushi — Confirmação de Pedido*\n#1' })
        );
        bot.emit(
            'message_create',
            makeMsg({ fromMe: true, body: '🛵 *Shimã Sushi — Pedido Saiu para Entrega!*\n#1' })
        );

        await new Promise((resolve) => setTimeout(resolve, 40));

        assert.equal(replies.length, 2);
        assert.deepEqual(replies[0].options, {});
        assert.deepEqual(replies[1].options, { sendSeen: false });
    });

    it('REG-004: normalização de DDI 55 e preservação de JID @lid em números brasileiros', async () => {
        const res = await sendTextMessage('27988460599', 'Mensagem regressão @lid');
        assert.deepEqual(mockState.getNumberIdCalls, ['5527988460599']);
        assert.equal(res.chatId, '2310776348749@lid');
        assert.equal(mockState.sendMessageCalls.length, 1);
        assert.deepEqual(mockState.sendMessageCalls[0].options, { sendSeen: false });
    });

    it('REG-005: sincronia do campo orders.status entre model Order, tabela MySQL e SequelizeMeta', async () => {
        const statusAttr = dataSource.Order.rawAttributes.status;
        assert.ok(statusAttr, 'Model Order deve declarar o atributo status');
        assert.equal(statusAttr.allowNull, false);
        assert.equal(statusAttr.defaultValue, 'Em preparo');

        const [cols] = await dataSource.sequelize.query("SHOW COLUMNS FROM orders LIKE 'status'");
        assert.equal(cols.length, 1);
        assert.equal(cols[0].Default, 'Em preparo');

        const [migrations] = await dataSource.sequelize.query(
            "SELECT name FROM SequelizeMeta WHERE name = '20261125150500-add-status-to-orders.js'"
        );
        assert.equal(migrations.length, 1);
    });

    it('REG-006: sendRandomCustomerOrder deve sortear IDs reais existentes e usar o item real do banco', async () => {
        const ids = await orderServices.getAllOrderIds();
        assert.ok(ids.includes(tempOrder1Id));
        assert.ok(ids.includes(tempOrder2Id));
        for (let i = 1; i < ids.length; i++) {
            assert.ok(ids[i] > ids[i - 1], 'getAllOrderIds deve retornar IDs em ordem crescente');
        }

        const directRes = await sendCustomerOrder(tempOrder1Id);
        assert.ok(directRes.message.includes(`Combinado Regressão ${uniqueSuffix}`));

        const randomRes = await sendRandomCustomerOrder('27988460599');
        const pickedOrder = await orderServices.getOrderWithDetailsById(randomRes.orderId);
        assert.ok(pickedOrder, 'Pedido sorteado deve existir no banco');
        if (pickedOrder.Menu_item) {
            assert.ok(randomRes.message.includes(pickedOrder.Menu_item.name));
        }
    });

    it('REG-007: liberação pelo Admin exige role admin, mantém atomicidade no 404 e atualiza para "Saiu para entrega"', async () => {
        await assert.rejects(
            () => dispatchOrderForDelivery(tempOrder2Id, { adminRole: 'user' }),
            (err) => err.status === 403
        );

        mockState.numberExists = false;
        await assert.rejects(
            () => dispatchOrderForDelivery(tempOrder2Id, { adminRole: 'admin' }),
            (err) => err.status === 404
        );
        const stillPending = await dataSource.Order.findByPk(tempOrder2Id);
        assert.equal(stillPending.status, 'Em preparo');

        mockState.numberExists = true;
        const dispatched = await dispatchOrderForDelivery(tempOrder2Id, { adminRole: 'admin' });
        assert.equal(dispatched.status, 'Saiu para entrega');
        assert.ok(dispatched.message.startsWith('🛵 *Shimã Sushi — Pedido Saiu para Entrega!*'));

        const dbDispatched = await dataSource.Order.findByPk(tempOrder2Id);
        assert.equal(dbDispatched.status, 'Saiu para entrega');

        await assert.rejects(
            () => dispatchOrderForDelivery(tempOrder2Id, { adminRole: 'admin' }),
            (err) => err.status === 400
        );
    });

    it('REG-008: integridade CommonJS, server.js/app.js, ocultação de password e contrato { msg, status }', async () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
        assert.equal(pkg.type, 'commonjs');

        const serverSource = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
        assert.ok(!/\bimport\s+/.test(serverSource) && !/\bexport\s+default\b/.test(serverSource));

        const app = require('../app.js');
        assert.equal(typeof app, 'function');

        const safeCustomer = await customerServices.getRegistryById(tempCustomerId);
        assert.equal(safeCustomer.password, undefined);

        const safeOrder = await orderServices.getOrderWithDetailsById(tempOrder1Id);
        assert.equal(safeOrder.Customer.password, undefined);

        const captureError = (errInstance) => {
            let capturedStatus;
            let capturedPayload;
            const fakeRes = {
                status(code) {
                    capturedStatus = code;
                    return this;
                },
                send(payload) {
                    capturedPayload = payload;
                },
            };
            errInstance.sendResponse(fakeRes);
            return { capturedStatus, capturedPayload };
        };

        const err500 = captureError(new BaseError());
        assert.equal(err500.capturedStatus, 500);
        assert.deepEqual(err500.capturedPayload, { msg: 'Erro interno do servidor', status: 500 });

        const err404 = captureError(new NotFound());
        assert.equal(err404.capturedStatus, 404);
        assert.deepEqual(err404.capturedPayload, { msg: 'Página não encontrada', status: 404 });

        const err400 = captureError(new RequisicaoIncorreta());
        assert.equal(err400.capturedStatus, 400);
        assert.deepEqual(err400.capturedPayload, {
            msg: 'Um ou mais dados fornecidos estão incorretos',
            status: 400,
        });
    });
});
