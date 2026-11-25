const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const dataSource = require('../src/models');
const OrderServices = require('../src/services/OrderServices.js');
const { EncryptPassword } = require('../src/cfg/bcryptHash.js');
const BaseError = require('../src/errors/BaseError.js');
const NotFound = require('../src/errors/NotFound.js');
const RequisicaoIncorreta = require('../src/errors/RequisicaoIncorreta.js');

const capturedDispatches = [];
const orderServices = new OrderServices();

// Dublê isolado de whatsappWeb.js para capturar parâmetros sanitizados no despacho sem abrir Chrome
const whatsappModulePath = require.resolve('../src/cfg/whatsappWeb.js');
require.cache[whatsappModulePath] = {
    id: whatsappModulePath,
    filename: whatsappModulePath,
    loaded: true,
    exports: {
        bot: {},
        waitUntilBotReady: async () => {},
        disconnectBot: async () => {},
        dispatchOrderForDelivery: async (orderId, dispatchData = {}) => {
            if (dispatchData.adminRole !== undefined && dispatchData.adminRole !== 'admin') {
                throw new BaseError('Acesso negado', 403);
            }
            const existing = await orderServices.getOrderWithDetailsById(orderId);
            if (!existing) {
                throw new NotFound(`Pedido #${orderId} não encontrado.`);
            }
            if (existing.status === 'Saiu para entrega' && !dispatchData.forceResend) {
                throw new RequisicaoIncorreta(`Pedido #${orderId} já despachado.`);
            }
            const { order } = await orderServices.releaseOrderForDelivery(orderId);
            capturedDispatches.push({ orderId: order.id, dispatchData });
            return {
                orderId: order.id,
                status: order.status,
                chatId: '5527988460599@c.us',
                message: 'Despachado',
                sentMessage: {},
            };
        },
        dispatchLastCustomerOrder: async (options = {}) => {
            const lastId = await orderServices.getLastPendingOrderId();
            if (!lastId) throw new NotFound('Sem pedidos pendentes.');
            return require.cache[whatsappModulePath].exports.dispatchOrderForDelivery(lastId, options);
        },
    },
};

const app = require('../app.js');

describe('Bateria de Testes — Sanitização e Validação de Inputs (Login, Usuários e Pedidos)', () => {
    let server;
    let baseUrl;

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const userEmailRaw = `  Teste.XSS.${uniqueSuffix}@SHIMA.TEST  `;
    const userEmailClean = `teste.xss.${uniqueSuffix}@shima.test`;
    const secondUserEmail = `outro.${uniqueSuffix}@shima.test`;
    const adminEmail = `val.admin.${uniqueSuffix}@shima.test`;
    const passwordValid = 'SenhaSegura123!';

    let sanitizedUserId;
    let secondUserId;
    let adminId;
    let userToken;
    let adminToken;
    let menuItemId;
    const createdOrderIds = [];

    async function apiRequest(path, { method = 'GET', token, body } = {}) {
        const headers = {};
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (token) headers.authorization = `Bearer ${token}`;
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
            // Resposta textual
        }
        return { status: response.status, data };
    }

    before(async () => {
        await dataSource.sequelize.authenticate();

        const hashedAdminPw = await EncryptPassword(passwordValid);
        const admin = await dataSource.Customer.create({
            name: 'Admin Validação',
            password: hashedAdminPw,
            email: adminEmail,
            address: 'Rua Admin, 100 - Centro',
            phone: '27999990001',
            role: 'admin',
        });
        adminId = admin.id;

        const menuItem = await dataSource.Menu_item.create({
            name: `Temaki Validação ${uniqueSuffix}`,
            category: 'Temaki',
            ingredients: 'Salmão',
            price: 42.5,
            description: 'Item temporário para validação de pedidos',
            quantity: 1,
            stock: 20,
        });
        menuItemId = menuItem.id;

        server = http.createServer(app);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;

        const adminLogin = await apiRequest('/login', {
            method: 'POST',
            body: { email: adminEmail, password: passwordValid },
        });
        adminToken = adminLogin.data.token;
    });

    after(async () => {
        if (createdOrderIds.length > 0) {
            await dataSource.Order.destroy({ where: { id: createdOrderIds } });
        }
        if (menuItemId) {
            await dataSource.Menu_item.destroy({ where: { id: menuItemId } });
        }
        const idsToDelete = [sanitizedUserId, secondUserId, adminId].filter(Boolean);
        if (idsToDelete.length > 0) {
            await dataSource.Customer.destroy({ where: { id: idsToDelete } });
        }
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
        await dataSource.sequelize.close();
    });

    describe('1. Registro de Usuário (/register e /users/) — Sanitização e Mass Assignment', () => {
        it('deve remover tags <script>/HTML, normalizar email/telefone e ignorar tentativa de enviar role: "admin"', async () => {
            const res = await apiRequest('/register', {
                method: 'POST',
                body: {
                    name: '  <script>alert(1)</script>João   <b>Silva</b>  ',
                    password: passwordValid,
                    repeatPassword: passwordValid,
                    email: userEmailRaw,
                    address: '  Rua   <img src=x onerror=alert(1)> das Flores,   120  ',
                    phone: '(027) 98846-0599',
                    role: 'admin',
                },
            });

            assert.equal(res.status, 201);
            assert.equal(res.data.user.name, 'João Silva');
            assert.equal(res.data.user.email, userEmailClean);
            assert.equal(res.data.user.address, 'Rua das Flores, 120');
            assert.equal(res.data.user.phone, '27988460599');
            assert.equal(res.data.user.role, 'user');
            sanitizedUserId = res.data.user.id;
        });

        it('deve rejeitar dados inválidos (XSS vazio, email malformado, senha curta/longa, DDD inválido, endereço curto, tipo objeto)', async () => {
            const basePayload = {
                name: 'Maria Souza',
                password: passwordValid,
                repeatPassword: passwordValid,
                email: `valido.${uniqueSuffix}@shima.test`,
                address: 'Av. Central, 300',
                phone: '27988460599',
            };

            const invalidCases = [
                { ...basePayload, name: '<script>evil()</script>' },
                { ...basePayload, name: '123456' },
                { ...basePayload, email: 'email-sem-arroba.com' },
                { ...basePayload, password: '123', repeatPassword: '123' },
                { ...basePayload, password: 'a'.repeat(73), repeatPassword: 'a'.repeat(73) },
                { ...basePayload, phone: '00988460599' },
                { ...basePayload, phone: '12345' },
                { ...basePayload, address: 'Rua' },
                { ...basePayload, name: { $ne: null } },
                { ...basePayload, phone: ['27988460599'] },
            ];

            for (const payload of invalidCases) {
                const res = await apiRequest('/register', { method: 'POST', body: payload });
                assert.equal(res.status, 400, `Esperava 400 para payload: ${JSON.stringify(payload)}`);
            }
        });
    });

    describe('2. Login (/login) — Sanitização e Proteção contra Injeção de Tipo', () => {
        it('deve autenticar corretamente quando o email vem com espaços e maiúsculas', async () => {
            const res = await apiRequest('/login', {
                method: 'POST',
                body: {
                    email: `   ${userEmailClean.toUpperCase()}  `,
                    password: passwordValid,
                },
            });
            assert.equal(res.status, 200);
            assert.ok(res.data.token);
            userToken = res.data.token;
        });

        it('deve bloquear operator injection, email inválido e senha acima do limite com 400', async () => {
            const badCases = [
                { email: { $ne: null }, password: passwordValid },
                { email: userEmailClean, password: ['123456'] },
                { email: 'nao-e-email', password: passwordValid },
                { email: userEmailClean, password: 'x'.repeat(129) },
                { email: userEmailClean, password: 'abc\0def' },
            ];

            for (const body of badCases) {
                const res = await apiRequest('/login', { method: 'POST', body });
                assert.equal(res.status, 400);
            }
        });
    });

    describe('3. Atualização e Parâmetros de Usuário (/users/:id)', () => {
        it('deve rejeitar :id não numérico ou <= 0 com 400', async () => {
            for (const badId of ['abc', '0', '-5', '1.5']) {
                const res = await apiRequest(`/users/${badId}`);
                assert.equal(res.status, 400);
            }
        });

        it('deve bloquear tentativa de escalonar role para admin, email duplicado e formatos inválidos no PUT /users/:id', async () => {
            const secondRes = await apiRequest('/users/', {
                method: 'POST',
                body: {
                    name: 'Segundo Usuário',
                    password: passwordValid,
                    repeatPassword: passwordValid,
                    email: secondUserEmail,
                    address: 'Av. Vitória, 900',
                    phone: '27988460598',
                },
            });
            assert.equal(secondRes.status, 201);
            secondUserId = secondRes.data.user.id;

            // Apenas role não permitido -> 400
            const roleOnly = await apiRequest(`/users/${sanitizedUserId}`, {
                method: 'PUT',
                body: { role: 'admin' },
            });
            assert.equal(roleOnly.status, 400);

            // Email já pertencente a outro usuário -> 400
            const dupEmail = await apiRequest(`/users/${sanitizedUserId}`, {
                method: 'PUT',
                body: { email: secondUserEmail },
            });
            assert.equal(dupEmail.status, 400);
            assert.equal(dupEmail.data.msg, 'Email já cadastrado');

            // Dados válidos acompanhados de role: 'admin' -> atualiza dados limpos, mas mantém role: 'user'
            const cleanUpdate = await apiRequest(`/users/${sanitizedUserId}`, {
                method: 'PUT',
                body: {
                    name: '<b>João Atualizado</b>',
                    phone: '(27) 99999-8888',
                    role: 'admin',
                },
            });
            assert.equal(cleanUpdate.status, 200);

            const checkUser = await apiRequest(`/users/${sanitizedUserId}`);
            assert.equal(checkUser.status, 200);
            assert.equal(checkUser.data.name, 'João Atualizado');
            assert.equal(checkUser.data.phone, '27999998888');
            assert.equal(checkUser.data.role, 'user');
        });
    });

    describe('4. Pedidos de Clientes (/pedidos/) — Sanitização e Validação', () => {
        let validOrderId;

        it('deve rejeitar :id inválido em GET/PUT/DELETE/PATCH /pedidos/:id com 400', async () => {
            assert.equal((await apiRequest('/pedidos/abc')).status, 400);
            assert.equal((await apiRequest('/pedidos/0')).status, 400);
            assert.equal(
                (await apiRequest('/pedidos/abc/despachar', { method: 'PATCH', token: adminToken }))
                    .status,
                400
            );
        });

        it('deve validar todos os campos inválidos no POST /pedidos/ com 400', async () => {
            const baseOrder = {
                customer_id: sanitizedUserId,
                order_items_id: menuItemId,
                order_date: new Date().toISOString(),
                total_amount: 42.5,
            };

            const badOrders = [
                { ...baseOrder, customer_id: 'abc' },
                { ...baseOrder, order_items_id: 0 },
                { ...baseOrder, total_amount: -10 },
                { ...baseOrder, total_amount: 'caro' },
                { ...baseOrder, total_amount: true },
                { ...baseOrder, order_date: 'data-invalida' },
                { ...baseOrder, status: 'Status Inventado' },
                { ...baseOrder, phone: '123' },
                { ...baseOrder, deliveryFee: -5 },
                { ...baseOrder, items: [{ name: '<script>x</script>', quantity: 1 }] },
            ];

            for (const body of badOrders) {
                const res = await apiRequest('/pedidos/', {
                    method: 'POST',
                    token: userToken,
                    body,
                });
                assert.equal(res.status, 400, `Esperava 400 para pedido: ${JSON.stringify(body)}`);
            }
        });

        it('deve criar pedido válido mesmo omitindo order_date e arredondando total_amount', async () => {
            const res = await apiRequest('/pedidos/', {
                method: 'POST',
                token: userToken,
                body: {
                    customer_id: String(sanitizedUserId),
                    order_items_id: menuItemId,
                    total_amount: '42.556',
                    address: '<script>xss</script>Rua Limpa, 99',
                },
            });
            assert.equal(res.status, 201);
            assert.equal(res.data.customer_id, sanitizedUserId);
            assert.equal(res.data.total_amount, 42.56);
            assert.equal(res.data.status, 'Em preparo');
            assert.ok(res.data.order_date);
            validOrderId = res.data.id;
            createdOrderIds.push(validOrderId);
        });

        it('deve validar PUT /pedidos/:id e sanitizar textos opcionais em PATCH /pedidos/:id/despachar', async () => {
            const badPut = await apiRequest(`/pedidos/${validOrderId}`, {
                method: 'PUT',
                body: { status: 'Invalido' },
            });
            assert.equal(badPut.status, 400);

            const noAllowedFields = await apiRequest(`/pedidos/${validOrderId}`, {
                method: 'PUT',
                body: { campoDesconhecido: 123 },
            });
            assert.equal(noAllowedFields.status, 400);

            const badDispatchPhone = await apiRequest(`/pedidos/${validOrderId}/despachar`, {
                method: 'PATCH',
                token: adminToken,
                body: { phone: '999' },
            });
            assert.equal(badDispatchPhone.status, 400);

            const cleanDispatch = await apiRequest(`/pedidos/${validOrderId}/despachar`, {
                method: 'PATCH',
                token: adminToken,
                body: {
                    courierName: '<script>alert(1)</script><b>Carlos   Entregador</b>',
                    phone: '(27) 98846-0599',
                    estimatedTime: '20 minutos',
                },
            });
            assert.equal(cleanDispatch.status, 200);
            assert.equal(capturedDispatches.length, 1);
            assert.equal(capturedDispatches[0].dispatchData.courierName, 'Carlos Entregador');
            assert.equal(capturedDispatches[0].dispatchData.phone, '27988460599');
        });
    });
});
