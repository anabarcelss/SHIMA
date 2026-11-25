const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const dataSource = require('../src/models');
const OrderServices = require('../src/services/OrderServices.js');
const { EncryptPassword } = require('../src/cfg/bcryptHash.js');
const BaseError = require('../src/errors/BaseError.js');
const NotFound = require('../src/errors/NotFound.js');
const RequisicaoIncorreta = require('../src/errors/RequisicaoIncorreta.js');

const whatsappStubState = {
    botReady: true,
    sentDispatches: [],
};

// Injeta dublê controlado de whatsappWeb.js antes de carregar app.js para evitar abrir o navegador real
const whatsappModulePath = require.resolve('../src/cfg/whatsappWeb.js');
const orderServices = new OrderServices();

async function stubDispatchOrderForDelivery(orderId, dispatchData = {}) {
    if (dispatchData.adminRole !== undefined && dispatchData.adminRole !== 'admin') {
        throw new BaseError(
            'Acesso negado: apenas administradores podem liberar pedidos para entrega.',
            403
        );
    }
    if (!orderId) {
        throw new RequisicaoIncorreta('ID do pedido não informado.');
    }
    if (!whatsappStubState.botReady) {
        throw new BaseError(
            'Cliente do WhatsApp ainda não está pronto para enviar mensagens.',
            503
        );
    }

    const existing = await orderServices.getOrderWithDetailsById(orderId);
    if (!existing) {
        throw new NotFound(`Pedido #${orderId} não encontrado.`);
    }
    if (
        (existing.status === 'Saiu para entrega' || existing.status === 'Entregue') &&
        !dispatchData.forceResend
    ) {
        throw new RequisicaoIncorreta(
            `O pedido #${existing.id} já foi liberado para entrega (status: ${existing.status}).`
        );
    }

    const { order } = await orderServices.releaseOrderForDelivery(orderId);
    const digits = String(dispatchData.phone || order.Customer?.phone || '5527988460599').replace(
        /\D/g,
        ''
    );
    const chatId = `${digits.startsWith('55') ? digits : `55${digits}`}@c.us`;
    whatsappStubState.sentDispatches.push({
        orderId: order.id,
        chatId,
        courierName: dispatchData.courierName || null,
    });

    return {
        orderId: order.id,
        status: order.status,
        chatId,
        message: `Pedido #${order.id} saiu para entrega`,
        sentMessage: { id: { _serialized: `mock-msg-${order.id}` } },
    };
}

async function stubDispatchLastCustomerOrder(options = {}) {
    if (options.adminRole !== undefined && options.adminRole !== 'admin') {
        throw new BaseError(
            'Acesso negado: apenas administradores podem liberar pedidos para entrega.',
            403
        );
    }
    const lastPendingId = await orderServices.getLastPendingOrderId();
    if (!lastPendingId) {
        throw new NotFound(
            'Não há pedidos pendentes ("Em preparo") aguardando liberação para entrega.'
        );
    }
    return stubDispatchOrderForDelivery(lastPendingId, options);
}

require.cache[whatsappModulePath] = {
    id: whatsappModulePath,
    filename: whatsappModulePath,
    loaded: true,
    exports: {
        bot: {},
        waitUntilBotReady: async () => {},
        disconnectBot: async () => {},
        dispatchOrderForDelivery: stubDispatchOrderForDelivery,
        dispatchLastCustomerOrder: stubDispatchLastCustomerOrder,
    },
};

const app = require('../app.js');

describe('Bateria de Testes — Endpoints da API Shimã Sushi', () => {
    let server;
    let baseUrl;

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const customerEmail = `teste.cliente.${uniqueSuffix}@shima.test`;
    const adminEmail = `teste.admin.${uniqueSuffix}@shima.test`;
    let customerPassword = 'SenhaUser123!';
    const adminPassword = 'SenhaAdmin123!';

    let customerId;
    let extraCustomerId;
    let adminId;
    let userToken;
    let adminToken;
    let createdMenuItemId;
    const createdOrderIds = [];

    async function apiRequest(path, { method = 'GET', token, body } = {}) {
        const headers = {};
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }
        if (token) {
            headers.authorization = `Bearer ${token}`;
        }
        const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const text = await response.text();
        let data = text;
        try {
            data = JSON.parse(text);
        } catch (_) {
            // Mantém resposta textual quando não for JSON (ex.: GET /)
        }
        return { status: response.status, headers: response.headers, data };
    }

    before(async () => {
        await dataSource.sequelize.authenticate();

        // Cria admin temporário diretamente no banco para testar rotas exclusivas de admin
        const hashedAdminPw = await EncryptPassword(adminPassword);
        const admin = await dataSource.Customer.create({
            name: 'Admin Teste API',
            password: hashedAdminPw,
            email: adminEmail,
            address: 'Rua do Restaurante, 100 - Centro',
            phone: '27999990000',
            role: 'admin',
        });
        adminId = admin.id;

        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
    });

    after(async () => {
        if (createdOrderIds.length > 0) {
            await dataSource.Order.destroy({ where: { id: createdOrderIds } });
        }
        if (createdMenuItemId) {
            await dataSource.Menu_item.destroy({ where: { id: createdMenuItemId } });
        }
        const idsToDelete = [customerId, extraCustomerId, adminId].filter(Boolean);
        if (idsToDelete.length > 0) {
            await dataSource.Customer.destroy({ where: { id: idsToDelete } });
        }
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        await dataSource.sequelize.close();
    });

    describe('1. Rotas gerais e middleware 404', () => {
        it('GET / deve responder 200 com "Shimã Sushi API"', async () => {
            const res = await apiRequest('/');
            assert.equal(res.status, 200);
            assert.equal(res.data, 'Shimã Sushi API');
        });

        it('GET /rota-inexistente deve responder 404 padronizado via handler404', async () => {
            const res = await apiRequest('/rota-que-nao-existe');
            assert.equal(res.status, 404);
            assert.equal(res.data.status, 404);
            assert.equal(res.data.msg, 'Página não encontrada');
        });
    });

    describe('2. Clientes e Autenticação (/register, /login, /users/)', () => {
        it('POST /register sem campos obrigatórios deve retornar 400', async () => {
            const res = await apiRequest('/register', {
                method: 'POST',
                body: { name: 'Incompleto' },
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.status, 400);
        });

        it('POST /register com senhas divergentes deve retornar 400', async () => {
            const res = await apiRequest('/register', {
                method: 'POST',
                body: {
                    name: 'Cliente Teste',
                    password: customerPassword,
                    repeatPassword: 'OutraSenha999',
                    email: customerEmail,
                    address: 'Av. Central, 50',
                    phone: '27988460599',
                },
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.msg, 'As senhas não coincidem');
        });

        it('POST /register válido deve retornar 201 com role user e sem expor password', async () => {
            const res = await apiRequest('/register', {
                method: 'POST',
                body: {
                    name: 'Cliente Teste API',
                    password: customerPassword,
                    repeatPassword: customerPassword,
                    email: customerEmail,
                    address: 'Rua das Flores, 200',
                    phone: '27988460599',
                },
            });
            assert.equal(res.status, 201);
            assert.equal(res.data.msg, 'Usuário criado com sucesso');
            assert.ok(res.data.user.id);
            assert.equal(res.data.user.role, 'user');
            assert.equal(res.data.user.password, undefined);
            customerId = res.data.user.id;
        });

        it('POST /register com email duplicado deve retornar 400', async () => {
            const res = await apiRequest('/register', {
                method: 'POST',
                body: {
                    name: 'Duplicado',
                    password: customerPassword,
                    repeatPassword: customerPassword,
                    email: customerEmail,
                    address: 'Rua B, 10',
                    phone: '27988460599',
                },
            });
            assert.equal(res.status, 400);
            assert.equal(res.data.msg, 'Email já cadastrado');
        });

        it('POST /users/ deve registrar um segundo cliente via alias de cadastro', async () => {
            const res = await apiRequest('/users/', {
                method: 'POST',
                body: {
                    name: 'Cliente Alias Users',
                    password: customerPassword,
                    repeatPassword: customerPassword,
                    email: `alias.${uniqueSuffix}@shima.test`,
                    address: 'Rua Alias, 77',
                    phone: '27988460598',
                },
            });
            assert.equal(res.status, 201);
            assert.equal(res.data.user.password, undefined);
            extraCustomerId = res.data.user.id;
        });

        it('POST /login sem dados deve retornar 400', async () => {
            const res = await apiRequest('/login', { method: 'POST', body: {} });
            assert.equal(res.status, 400);
        });

        it('POST /login com email inexistente deve retornar 404', async () => {
            const res = await apiRequest('/login', {
                method: 'POST',
                body: { email: 'naoexiste@shima.test', password: '123' },
            });
            assert.equal(res.status, 404);
        });

        it('POST /login com senha incorreta deve retornar 400', async () => {
            const res = await apiRequest('/login', {
                method: 'POST',
                body: { email: customerEmail, password: 'SenhaErrada' },
            });
            assert.equal(res.status, 400);
        });

        it('POST /login válido deve autenticar cliente e admin retornando tokens JWT', async () => {
            const userLogin = await apiRequest('/login', {
                method: 'POST',
                body: { email: customerEmail, password: customerPassword },
            });
            assert.equal(userLogin.status, 200);
            assert.ok(userLogin.data.token);
            assert.ok(userLogin.headers.get('authorization'));
            userToken = userLogin.data.token;

            const adminLogin = await apiRequest('/login', {
                method: 'POST',
                body: { email: adminEmail, password: adminPassword },
            });
            assert.equal(adminLogin.status, 200);
            assert.ok(adminLogin.data.token);
            adminToken = adminLogin.data.token;
        });

        it('GET /users/ deve retornar lista de clientes sem o campo password', async () => {
            const res = await apiRequest('/users/');
            assert.equal(res.status, 200);
            assert.ok(Array.isArray(res.data));
            assert.ok(res.data.length > 0);
            for (const user of res.data) {
                assert.equal(user.password, undefined);
            }
        });

        it('GET /users/:id existente deve retornar 200 sem password e inexistente 404', async () => {
            const okRes = await apiRequest(`/users/${customerId}`);
            assert.equal(okRes.status, 200);
            assert.equal(okRes.data.id, customerId);
            assert.equal(okRes.data.password, undefined);

            const notFoundRes = await apiRequest('/users/999999');
            assert.equal(notFoundRes.status, 404);
        });

        it('PUT /users/:id deve validar body vazio (400), ID inexistente (404) e atualizar senha criptografada (200)', async () => {
            const emptyRes = await apiRequest(`/users/${customerId}`, {
                method: 'PUT',
                body: {},
            });
            assert.equal(emptyRes.status, 400);

            const notFoundRes = await apiRequest('/users/999999', {
                method: 'PUT',
                body: { name: 'Ninguém' },
            });
            assert.equal(notFoundRes.status, 404);

            const newPassword = 'NovaSenhaUser456!';
            const okRes = await apiRequest(`/users/${customerId}`, {
                method: 'PUT',
                body: { name: 'Cliente Atualizado', password: newPassword },
            });
            assert.equal(okRes.status, 200);
            assert.equal(okRes.data.update, true);
            customerPassword = newPassword;

            const reloginRes = await apiRequest('/login', {
                method: 'POST',
                body: { email: customerEmail, password: customerPassword },
            });
            assert.equal(reloginRes.status, 200);
        });

        it('DELETE /users/:id deve retornar 404 para inexistente e 200 para cliente válido', async () => {
            const notFoundRes = await apiRequest('/users/999999', { method: 'DELETE' });
            assert.equal(notFoundRes.status, 404);

            const okRes = await apiRequest(`/users/${extraCustomerId}`, { method: 'DELETE' });
            assert.equal(okRes.status, 200);
            extraCustomerId = null;
        });
    });

    describe('3. Cardápio (/menu/)', () => {
        it('GET /menu/ público deve retornar 200 com array de itens', async () => {
            const res = await apiRequest('/menu/');
            assert.equal(res.status, 200);
            assert.ok(Array.isArray(res.data));
        });

        it('POST /menu/ deve exigir JWT (401), validar body vazio (400) e criar item com token válido (201)', async () => {
            const noToken = await apiRequest('/menu/', {
                method: 'POST',
                body: { name: 'Teste', price: 10 },
            });
            assert.equal(noToken.status, 401);

            const badToken = await apiRequest('/menu/', {
                method: 'POST',
                token: 'token.invalido.aqui',
                body: { name: 'Teste', price: 10 },
            });
            assert.equal(badToken.status, 401);

            const emptyBody = await apiRequest('/menu/', {
                method: 'POST',
                token: adminToken,
                body: {},
            });
            assert.equal(emptyBody.status, 400);

            const okRes = await apiRequest('/menu/', {
                method: 'POST',
                token: adminToken,
                body: {
                    name: `Combinado Teste ${uniqueSuffix}`,
                    category: 'Combinados',
                    ingredients: 'Salmão fresco e arroz shari',
                    price: 59.9,
                    description: 'Item criado pela bateria de testes',
                    quantity: 12,
                    stock: 20,
                },
            });
            assert.equal(okRes.status, 201);
            assert.ok(okRes.data.id);
            createdMenuItemId = okRes.data.id;
        });

        it('GET /menu/:id existente deve retornar 200 e inexistente 404', async () => {
            const okRes = await apiRequest(`/menu/${createdMenuItemId}`);
            assert.equal(okRes.status, 200);
            assert.equal(okRes.data.id, createdMenuItemId);

            const notFoundRes = await apiRequest('/menu/999999');
            assert.equal(notFoundRes.status, 404);
        });

        it('PUT /menu/:id deve exigir JWT (401), validar body/ID (400/404) e atualizar (200)', async () => {
            const noToken = await apiRequest(`/menu/${createdMenuItemId}`, {
                method: 'PUT',
                body: { price: 65.0 },
            });
            assert.equal(noToken.status, 401);

            const emptyBody = await apiRequest(`/menu/${createdMenuItemId}`, {
                method: 'PUT',
                token: adminToken,
                body: {},
            });
            assert.equal(emptyBody.status, 400);

            const notFound = await apiRequest('/menu/999999', {
                method: 'PUT',
                token: adminToken,
                body: { price: 65.0 },
            });
            assert.equal(notFound.status, 404);

            const okRes = await apiRequest(`/menu/${createdMenuItemId}`, {
                method: 'PUT',
                token: adminToken,
                body: { price: 64.9 },
            });
            assert.equal(okRes.status, 200);
            assert.equal(okRes.data.update, true);
        });
    });

    describe('4. Pedidos e Liberação de Entrega pelo Admin (/pedidos/)', () => {
        let firstOrderId;
        let lastOrderId;

        it('POST /pedidos/ deve exigir JWT (401), validar body/FK (400) e criar pedido com status "Em preparo" (201)', async () => {
            const noToken = await apiRequest('/pedidos/', {
                method: 'POST',
                body: { customer_id: customerId, order_date: new Date(), order_items_id: createdMenuItemId, total_amount: 64.9 },
            });
            assert.equal(noToken.status, 401);

            const emptyBody = await apiRequest('/pedidos/', {
                method: 'POST',
                token: userToken,
                body: {},
            });
            assert.equal(emptyBody.status, 400);

            const invalidFk = await apiRequest('/pedidos/', {
                method: 'POST',
                token: userToken,
                body: {
                    customer_id: 999999,
                    order_date: new Date().toISOString(),
                    order_items_id: createdMenuItemId,
                    total_amount: 64.9,
                },
            });
            assert.equal(invalidFk.status, 400);

            const okRes = await apiRequest('/pedidos/', {
                method: 'POST',
                token: userToken,
                body: {
                    customer_id: customerId,
                    order_date: new Date().toISOString(),
                    order_items_id: createdMenuItemId,
                    total_amount: 64.9,
                },
            });
            assert.equal(okRes.status, 201);
            assert.equal(okRes.data.status, 'Em preparo');
            firstOrderId = okRes.data.id;
            createdOrderIds.push(firstOrderId);
        });

        it('GET /pedidos/ deve exigir JWT (401) e listar pedidos com token válido (200)', async () => {
            const noToken = await apiRequest('/pedidos/');
            assert.equal(noToken.status, 401);

            const okRes = await apiRequest('/pedidos/', { token: userToken });
            assert.equal(okRes.status, 200);
            assert.ok(Array.isArray(okRes.data));
        });

        it('GET /pedidos/:id deve retornar 200 para existente e 404 para inexistente', async () => {
            const okRes = await apiRequest(`/pedidos/${firstOrderId}`);
            assert.equal(okRes.status, 200);
            assert.equal(okRes.data.id, firstOrderId);

            const notFound = await apiRequest('/pedidos/999999');
            assert.equal(notFound.status, 404);
        });

        it('PUT /pedidos/:id deve validar body vazio (400), inexistente (404) e atualizar pedido (200)', async () => {
            const emptyBody = await apiRequest(`/pedidos/${firstOrderId}`, {
                method: 'PUT',
                body: {},
            });
            assert.equal(emptyBody.status, 400);

            const notFound = await apiRequest('/pedidos/999999', {
                method: 'PUT',
                body: { total_amount: 70.0 },
            });
            assert.equal(notFound.status, 404);

            const okRes = await apiRequest(`/pedidos/${firstOrderId}`, {
                method: 'PUT',
                body: { total_amount: 69.9 },
            });
            assert.equal(okRes.status, 200);
            assert.equal(okRes.data.update, true);
        });

        it('PATCH /pedidos/:id/despachar deve respeitar 401, 403 (não-admin), 503 (bot offline), 404, 200 e 400 (duplicado)', async () => {
            const noToken = await apiRequest(`/pedidos/${firstOrderId}/despachar`, {
                method: 'PATCH',
            });
            assert.equal(noToken.status, 401);

            const nonAdmin = await apiRequest(`/pedidos/${firstOrderId}/despachar`, {
                method: 'PATCH',
                token: userToken,
            });
            assert.equal(nonAdmin.status, 403);

            whatsappStubState.botReady = false;
            const botOffline = await apiRequest(`/pedidos/${firstOrderId}/despachar`, {
                method: 'PATCH',
                token: adminToken,
            });
            assert.equal(botOffline.status, 503);
            whatsappStubState.botReady = true;

            const notFound = await apiRequest('/pedidos/999999/despachar', {
                method: 'PATCH',
                token: adminToken,
            });
            assert.equal(notFound.status, 404);

            const okRes = await apiRequest(`/pedidos/${firstOrderId}/despachar`, {
                method: 'PATCH',
                token: adminToken,
                body: { courierName: 'Motoboy Teste', estimatedTime: '20 minutos' },
            });
            assert.equal(okRes.status, 200);
            assert.equal(okRes.data.orderId, firstOrderId);
            assert.equal(okRes.data.status, 'Saiu para entrega');

            const duplicateRes = await apiRequest(`/pedidos/${firstOrderId}/despachar`, {
                method: 'PATCH',
                token: adminToken,
            });
            assert.equal(duplicateRes.status, 400);
        });

        it('PATCH /pedidos/despachar-ultimo deve bloquear não-admin (403) e despachar o último pedido pendente como admin (200)', async () => {
            const secondOrderRes = await apiRequest('/pedidos/', {
                method: 'POST',
                token: userToken,
                body: {
                    customer_id: customerId,
                    order_date: new Date().toISOString(),
                    order_items_id: createdMenuItemId,
                    total_amount: 129.8,
                },
            });
            assert.equal(secondOrderRes.status, 201);
            lastOrderId = secondOrderRes.data.id;
            createdOrderIds.push(lastOrderId);

            const nonAdmin = await apiRequest('/pedidos/despachar-ultimo', {
                method: 'PATCH',
                token: userToken,
            });
            assert.equal(nonAdmin.status, 403);

            const okRes = await apiRequest('/pedidos/despachar-ultimo', {
                method: 'PATCH',
                token: adminToken,
                body: { estimatedTime: '25 minutos' },
            });
            assert.equal(okRes.status, 200);
            assert.equal(okRes.data.orderId, lastOrderId);
            assert.equal(okRes.data.status, 'Saiu para entrega');
        });

        it('DELETE /pedidos/:id e DELETE /menu/:id devem exigir JWT (401), validar 404 e excluir (200)', async () => {
            const noTokenOrder = await apiRequest(`/pedidos/${firstOrderId}`, { method: 'DELETE' });
            assert.equal(noTokenOrder.status, 401);

            const notFoundOrder = await apiRequest('/pedidos/999999', {
                method: 'DELETE',
                token: adminToken,
            });
            assert.equal(notFoundOrder.status, 404);

            for (const oid of [firstOrderId, lastOrderId]) {
                const delOrder = await apiRequest(`/pedidos/${oid}`, {
                    method: 'DELETE',
                    token: adminToken,
                });
                assert.equal(delOrder.status, 200);
            }
            createdOrderIds.length = 0;

            const noTokenMenu = await apiRequest(`/menu/${createdMenuItemId}`, { method: 'DELETE' });
            assert.equal(noTokenMenu.status, 401);

            const notFoundMenu = await apiRequest('/menu/999999', {
                method: 'DELETE',
                token: adminToken,
            });
            assert.equal(notFoundMenu.status, 404);

            const delMenu = await apiRequest(`/menu/${createdMenuItemId}`, {
                method: 'DELETE',
                token: adminToken,
            });
            assert.equal(delMenu.status, 200);
            createdMenuItemId = null;
        });
    });
});
