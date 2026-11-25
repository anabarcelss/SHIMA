const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const OrderServices = require('../services/OrderServices.js');
const BaseError = require('../errors/BaseError.js');
const NotFound = require('../errors/NotFound.js');
const RequisicaoIncorreta = require('../errors/RequisicaoIncorreta.js');

const orderServices = new OrderServices();

const BOT_SIGNATURE_PREFIX = '🍣 *Shimã Sushi';
let isBotReady = false;
let isAttachedBrowser = false;
let initPromise = null;

// Usa o Chrome do sistema quando disponível ou delega para o Chromium do Puppeteer
const chromeExecutablePath =
    process.env.CHROME_EXECUTABLE_PATH ||
    (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);

// Armazena sessão e cache na raiz do projeto (fora de src/ e ignorados pelo git)
const authDataPath = path.resolve(__dirname, '../../.wwebjs_auth');
const webCachePath = path.resolve(__dirname, '../../.wwebjs_cache');

const bot = new Client({
    authStrategy: new LocalAuth({
        clientId: 'shima',
        dataPath: authDataPath,
    }),
    webVersionCache: {
        type: 'local',
        path: webCachePath,
    },
    // Evita expor HeadlessChrome no modo headless e substitui o Chrome/101 defasado padrão
    userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    puppeteer: {
        headless: true,
        executablePath: chromeExecutablePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
        ],
    },
});

console.log('Iniciando cliente do WhatsApp...');

bot.on('loading_screen', (percent, message) => {
    console.log(`Carregando WhatsApp Web: ${percent}% - ${message}`);
});

bot.on('qr', (qr) => {
    console.log('Escaneie este QR Code com o WhatsApp no celular:');
    qrcode.generate(qr, { small: true });
});

bot.on('authenticated', () => {
    console.log('Cliente do WhatsApp autenticado.');
});

bot.on('ready', () => {
    isBotReady = true;
    console.log('Cliente do WhatsApp está pronto!');
});

bot.on('auth_failure', (error) => {
    console.error('Falha na autenticação do WhatsApp:', error);
});

bot.on('disconnected', (reason) => {
    isBotReady = false;
    console.error('Cliente do WhatsApp desconectado:', reason);
});

const TEST_REPLY = '🍣 Olá! Bot do Shimã Sushi online e funcionando!';
const ORDER_HEADER = '🍣 *Shimã Sushi — Confirmação de Pedido*';
const DISPATCH_HEADER = '🛵 *Shimã Sushi — Pedido Saiu para Entrega!*';

// Formata valor numérico para moeda brasileira (R$ 0,00)
function formatCurrency(value) {
    const numeric = Number(value);
    const safeValue = Number.isFinite(numeric) ? numeric : 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    })
        .format(safeValue)
        .replace(/\u00a0/g, ' ');
}

// Formata data/hora do pedido no fuso de Brasília
function formatOrderDate(dateValue) {
    const parsedDate = dateValue ? new Date(dateValue) : new Date();
    const validDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    return validDate
        .toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        .replace(',', ' às');
}

// Formata número de telefone brasileiro para exibição legível
function formatPhoneDisplay(rawPhone) {
    if (!rawPhone) return 'Não informado';
    const clean = String(rawPhone).split('@')[0];
    let digits = clean.replace(/\D/g, '');
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        digits = digits.slice(2);
    }
    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return clean || 'Não informado';
}

// Normaliza o telefone do cliente e valida se existe conta ativa no WhatsApp
async function resolveWhatsAppChatId(rawPhone) {
    const phoneText = String(rawPhone || '').trim();
    if (!phoneText) {
        throw new RequisicaoIncorreta('Telefone do cliente não informado.');
    }
    if (/@(c\.us|lid|g\.us)$/.test(phoneText)) {
        return phoneText;
    }

    let digits = phoneText.replace(/\D/g, '').replace(/^0+/, '');
    if (digits.length < 10) {
        throw new RequisicaoIncorreta(`Número de telefone inválido para WhatsApp: ${rawPhone}`);
    }
    if (digits.length === 10 || digits.length === 11) {
        digits = `55${digits}`;
    }

    const numberId = await bot.getNumberId(digits);
    if (!numberId) {
        throw new NotFound(`O número ${rawPhone} não possui conta ativa no WhatsApp.`);
    }
    if (typeof numberId === 'string') {
        return numberId;
    }
    return numberId._serialized || numberId.$1 || `${digits}@c.us`;
}

// Monta a lista de itens combinando dados detalhados do app e o Menu_item associado ao Order
function formatOrderItems(order, appOrderData = {}) {
    if (Array.isArray(appOrderData.items) && appOrderData.items.length > 0) {
        return appOrderData.items
            .map((item) => {
                if (typeof item === 'string') {
                    return `• ${item.trim()}`;
                }
                const qty = item.quantity ?? item.qty ?? 1;
                const name = item.name || item.title || 'Item';
                const unitPrice = item.price ?? item.unitPrice;
                const priceSuffix = unitPrice != null ? ` (${formatCurrency(unitPrice)})` : '';
                return `• ${qty}x ${name}${priceSuffix}`;
            })
            .join('\n');
    }

    if (typeof appOrderData.items === 'string' && appOrderData.items.trim()) {
        return `• ${appOrderData.items.trim()}`;
    }

    if (order.Menu_item) {
        const unitPrice = Number(order.Menu_item.price);
        const total = Number(order.total_amount);
        let inferredQty = 1;
        if (unitPrice > 0 && total > 0) {
            const ratio = Math.round(total / unitPrice);
            if (ratio >= 1 && Math.abs(ratio * unitPrice - total) < 0.05) {
                inferredQty = ratio;
            }
        }
        const qty = appOrderData.quantity ?? inferredQty;
        const itemPrice =
            order.Menu_item.price != null ? ` (${formatCurrency(order.Menu_item.price)})` : '';
        return `• ${qty}x ${order.Menu_item.name}${itemPrice}`;
    }

    return '• Itens conforme pedido';
}

// Extrai e normaliza os campos compartilhados entre confirmação e saída para entrega
function extractOrderSummary(order, extraData = {}, defaultEstimatedTime = '40 a 50 minutos') {
    const customer = order.Customer || {};
    const customerName =
        extraData.customerName || extraData.customer_name || customer.name || 'Cliente';
    const rawPhone =
        extraData.phone ||
        extraData.customerPhone ||
        extraData.customer_phone ||
        customer.phone;
    const formattedPhone = formatPhoneDisplay(rawPhone);

    const baseAddress = String(
        extraData.address || customer.address || 'Não informado'
    ).trim();
    const addressNumber = extraData.addressNumber ?? extraData.numero;
    const numberText = addressNumber != null ? String(addressNumber).trim() : '';
    const fullAddress =
        numberText && !baseAddress.includes(numberText)
            ? `${baseAddress}, Nº ${numberText}`
            : baseAddress;

    const itemsText = formatOrderItems(order, extraData);

    const rawEstimated = extraData.estimatedTime ?? extraData.estimated_time;
    let estimatedTime = defaultEstimatedTime;
    if (typeof rawEstimated === 'number' && Number.isFinite(rawEstimated)) {
        estimatedTime = `${rawEstimated} minutos`;
    } else if (typeof rawEstimated === 'string' && rawEstimated.trim()) {
        estimatedTime = rawEstimated.trim();
    }

    const rawItemsPrice =
        extraData.subtotal != null || extraData.price != null
            ? Number(extraData.subtotal ?? extraData.price)
            : Number(order.total_amount ?? 0);
    const itemsPrice = Number.isFinite(rawItemsPrice) ? rawItemsPrice : 0;

    const rawDeliveryFee = Number(extraData.deliveryFee ?? extraData.delivery_fee ?? 0);
    const deliveryFee = Number.isFinite(rawDeliveryFee) ? rawDeliveryFee : 0;

    const rawTotal =
        extraData.totalWithDelivery != null
            ? Number(extraData.totalWithDelivery)
            : itemsPrice + deliveryFee;
    const totalAmount = Number.isFinite(rawTotal) ? rawTotal : itemsPrice + deliveryFee;

    return {
        customerName,
        formattedPhone,
        fullAddress,
        itemsText,
        estimatedTime,
        itemsPrice,
        deliveryFee,
        totalAmount,
    };
}

/**
 * Monta a mensagem padronizada de confirmação do pedido para envio ao cliente.
 * @param {object} order Registro retornado pelo model Order (com Customer e Menu_item)
 * @param {object} [appOrderData] Dados complementares enviados pelo app (tempo estimado, taxa, etc.)
 * @returns {string}
 */
function formatOrderMessage(order, appOrderData = {}) {
    const {
        customerName,
        formattedPhone,
        fullAddress,
        itemsText,
        estimatedTime,
        itemsPrice,
        deliveryFee,
        totalAmount,
    } = extractOrderSummary(order, appOrderData, '40 a 50 minutos');
    const orderTime = formatOrderDate(
        appOrderData.orderDate || appOrderData.order_date || order.order_date || order.createdAt
    );

    return [
        ORDER_HEADER,
        '',
        `📋 *Número do pedido:* #${order.id}`,
        `👤 *Cliente:* ${customerName}`,
        `📞 *Número do cliente:* ${formattedPhone}`,
        `📍 *Endereço:* ${fullAddress}`,
        '',
        '🍱 *Itens do pedido:*',
        itemsText,
        '',
        `🕒 *Hora do pedido:* ${orderTime}`,
        `⏱️ *Tempo estimado:* ${estimatedTime}`,
        '',
        `💰 *Preço:* ${formatCurrency(itemsPrice)}`,
        `🛵 *Taxa de entrega:* ${deliveryFee === 0 ? 'Grátis (R$ 0,00)' : formatCurrency(deliveryFee)}`,
        `🧾 *Total:* ${formatCurrency(totalAmount)}`,
        '',
        'Obrigado pela preferência! Em breve seu pedido sairá para entrega. 🥢',
    ].join('\n');
}

/**
 * Monta a mensagem padronizada de saída para entrega quando o admin libera o pedido.
 * @param {object} order Registro retornado pelo model Order (com Customer e Menu_item)
 * @param {object} [dispatchData] Dados complementares da liberação (entregador, previsão, etc.)
 * @returns {string}
 */
function formatDispatchMessage(order, dispatchData = {}) {
    const {
        customerName,
        formattedPhone,
        fullAddress,
        itemsText,
        estimatedTime: estimatedArrival,
        itemsPrice,
        deliveryFee,
        totalAmount,
    } = extractOrderSummary(order, dispatchData, '20 a 30 minutos');
    const dispatchTime = formatOrderDate(dispatchData.dispatchedAt || new Date());
    const courierName = (dispatchData.courierName || dispatchData.delivererName || '').trim();
    const courierLine = courierName ? `\n🏍️ *Entregador:* ${courierName}` : '';

    return [
        DISPATCH_HEADER,
        '',
        `Olá, *${customerName}*! Seu pedido foi liberado pelo restaurante e já está a caminho! 🍣`,
        '',
        `📋 *Número do pedido:* #${order.id}`,
        `📌 *Status:* ${order.status || 'Saiu para entrega'}${courierLine}`,
        `📍 *Endereço de entrega:* ${fullAddress}`,
        `📞 *Número do cliente:* ${formattedPhone}`,
        '',
        '🍱 *Itens enviados:*',
        itemsText,
        '',
        `🕒 *Saída para entrega:* ${dispatchTime}`,
        `⏱️ *Previsão de chegada:* ${estimatedArrival}`,
        '',
        `💰 *Preço:* ${formatCurrency(itemsPrice)}`,
        `🛵 *Taxa de entrega:* ${deliveryFee === 0 ? 'Grátis (R$ 0,00)' : formatCurrency(deliveryFee)}`,
        `🧾 *Total:* ${formatCurrency(totalAmount)}`,
        '',
        'Fique atento(a) ao interfone ou celular para receber o entregador. Bom apetite! 🥢',
    ].join('\n');
}

/**
 * Busca o pedido e os dados do cliente pelo ID informado e envia a mensagem padronizada no WhatsApp.
 * @param {number|string|object} orderInput ID do pedido ou objeto do pedido contendo id/orderId
 * @param {object} [appOrderData] Dados complementares do pedido vindos do app
 * @returns {Promise<{orderId: number, chatId: string, message: string, sentMessage: object}>}
 */
async function sendCustomerOrder(orderInput, appOrderData = {}) {
    const isObjectInput = typeof orderInput === 'object' && orderInput !== null;
    const mergedAppData = isObjectInput
        ? { ...orderInput, ...appOrderData }
        : { ...appOrderData };
    const orderId = isObjectInput
        ? orderInput.orderId ?? orderInput.order_id ?? orderInput.id
        : orderInput;

    if (orderId === undefined || orderId === null || orderId === '') {
        throw new RequisicaoIncorreta('ID do pedido não informado.');
    }

    const order = await orderServices.getOrderWithDetailsById(orderId);
    if (!order) {
        throw new NotFound(`Pedido #${orderId} não encontrado.`);
    }

    const rawPhone =
        mergedAppData.phone ||
        mergedAppData.customerPhone ||
        mergedAppData.customer_phone ||
        order.Customer?.phone;
    if (!rawPhone) {
        throw new RequisicaoIncorreta(
            'Telefone do cliente não encontrado para envio no WhatsApp.'
        );
    }

    if (!bot.info || !bot.pupPage) {
        throw new BaseError(
            'Cliente do WhatsApp ainda não está pronto para enviar mensagens.',
            503
        );
    }

    const chatId = await resolveWhatsAppChatId(rawPhone);
    const messageText = formatOrderMessage(order, mergedAppData);
    const sentMessage = await bot.sendMessage(chatId, messageText, { sendSeen: false });

    return {
        orderId: order.id,
        chatId,
        message: messageText,
        sentMessage,
    };
}

/**
 * Sorteia um ID real existente na tabela orders e envia o pedido correspondente do banco.
 * @param {string} phone Número ou JID de destino no WhatsApp
 * @param {object} [appOrderData] Dados complementares opcionais
 * @returns {Promise<{orderId: number, chatId: string, message: string, sentMessage: object}>}
 */
async function sendRandomCustomerOrder(phone, appOrderData = {}) {
    const orderIds = await orderServices.getAllOrderIds();
    if (!orderIds || orderIds.length === 0) {
        throw new NotFound('Nenhum pedido encontrado na tabela orders.');
    }

    const selectedOrderId = orderIds[crypto.randomInt(0, orderIds.length)];
    return sendCustomerOrder(selectedOrderId, {
        ...appOrderData,
        phone,
    });
}

/**
 * Libera um pedido específico para entrega (atualiza o status para 'Saiu para entrega')
 * e notifica o cliente no WhatsApp.
 * @param {number|string|object} orderInput ID do pedido ou objeto contendo id/orderId
 * @param {object} [dispatchData] Opções de liberação (adminRole, phone, courierName, estimatedTime, forceResend)
 * @returns {Promise<{orderId: number, status: string, chatId: string, message: string, sentMessage: object}>}
 */
async function dispatchOrderForDelivery(orderInput, dispatchData = {}) {
    const isObjectInput = typeof orderInput === 'object' && orderInput !== null;
    const mergedData = isObjectInput
        ? { ...orderInput, ...dispatchData }
        : { ...dispatchData };
    const orderId = isObjectInput
        ? orderInput.orderId ?? orderInput.order_id ?? orderInput.id
        : orderInput;

    if (mergedData.adminRole !== undefined && mergedData.adminRole !== 'admin') {
        throw new BaseError(
            'Acesso negado: apenas administradores podem liberar pedidos para entrega.',
            403
        );
    }

    if (orderId === undefined || orderId === null || orderId === '') {
        throw new RequisicaoIncorreta('ID do pedido não informado.');
    }

    if (!bot.info || !bot.pupPage) {
        throw new BaseError(
            'Cliente do WhatsApp ainda não está pronto para enviar mensagens.',
            503
        );
    }

    const existingOrder = await orderServices.getOrderWithDetailsById(orderId);
    if (!existingOrder) {
        throw new NotFound(`Pedido #${orderId} não encontrado.`);
    }

    if (
        (existingOrder.status === 'Saiu para entrega' || existingOrder.status === 'Entregue') &&
        !mergedData.forceResend
    ) {
        throw new RequisicaoIncorreta(
            `O pedido #${existingOrder.id} já foi liberado para entrega (status: ${existingOrder.status}).`
        );
    }

    const rawPhone =
        mergedData.phone ||
        mergedData.customerPhone ||
        mergedData.customer_phone ||
        existingOrder.Customer?.phone;
    if (!rawPhone) {
        throw new RequisicaoIncorreta(
            'Telefone do cliente não encontrado para envio no WhatsApp.'
        );
    }

    // Valida o número no WhatsApp antes de alterar o status do pedido no banco
    const chatId = await resolveWhatsAppChatId(rawPhone);
    const { order } = await orderServices.releaseOrderForDelivery(orderId);
    const messageText = formatDispatchMessage(order, {
        ...mergedData,
        dispatchedAt: mergedData.dispatchedAt || new Date(),
    });
    const sentMessage = await bot.sendMessage(chatId, messageText, { sendSeen: false });

    return {
        orderId: order.id,
        status: order.status,
        chatId,
        message: messageText,
        sentMessage,
    };
}

/**
 * Busca o último pedido pendente ('Em preparo') aguardando liberação do admin,
 * altera o status para 'Saiu para entrega' e envia o aviso de entrega no WhatsApp.
 * @param {string|object} [phoneOrOptions={}] Número de destino ou objeto de opções da liberação
 * @param {object} [extraOptions={}] Opções extras quando o primeiro argumento for o telefone
 * @returns {Promise<{orderId: number, status: string, chatId: string, message: string, sentMessage: object}>}
 */
async function dispatchLastCustomerOrder(phoneOrOptions = {}, extraOptions = {}) {
    const mergedOptions =
        typeof phoneOrOptions === 'string'
            ? { ...extraOptions, phone: phoneOrOptions }
            : { ...(phoneOrOptions || {}), ...extraOptions };

    if (mergedOptions.adminRole !== undefined && mergedOptions.adminRole !== 'admin') {
        throw new BaseError(
            'Acesso negado: apenas administradores podem liberar pedidos para entrega.',
            403
        );
    }

    const pendingOrderId = await orderServices.getLastPendingOrderId();
    if (!pendingOrderId) {
        throw new NotFound(
            'Não há pedidos pendentes ("Em preparo") aguardando liberação para entrega.'
        );
    }

    return dispatchOrderForDelivery(pendingOrderId, mergedOptions);
}

/**
 * Envia uma mensagem de texto simples para o número informado no WhatsApp.
 * @param {string} phone Número de telefone ou JID de destino
 * @param {string} text Conteúdo textual da mensagem
 * @returns {Promise<{chatId: string, message: string, sentMessage: object}>}
 */
async function sendTextMessage(phone, text) {
    const messageText = String(text || '').trim();
    if (!messageText) {
        throw new RequisicaoIncorreta('O texto da mensagem não pode ser vazio.');
    }
    if (!bot.info || !bot.pupPage) {
        throw new BaseError(
            'Cliente do WhatsApp ainda não está pronto para enviar mensagens.',
            503
        );
    }

    const chatId = await resolveWhatsAppChatId(phone);
    const sentMessage = await bot.sendMessage(chatId, messageText, { sendSeen: false });

    return {
        chatId,
        message: messageText,
        sentMessage,
    };
}

// Processa mensagens de teste tanto de outros contatos quanto do próprio número
const handleTestMessage = async (message) => {
    if (
        message.isStatus ||
        message.from === 'status@broadcast' ||
        message.to === 'status@broadcast'
    ) {
        return;
    }

    const body = (message.body || '').trim();
    // Ignora mensagens vazias e respostas automáticas do próprio bot (evita loop em message_create)
    if (
        !body ||
        body === TEST_REPLY ||
        body.startsWith(BOT_SIGNATURE_PREFIX) ||
        body.startsWith(DISPATCH_HEADER)
    ) {
        return;
    }

    const contact = message.fromMe ? message.to : message.from;
    console.log(
        `Mensagem ${message.fromMe ? 'enviada por você para' : 'recebida de'} ${contact}: ${body}`
    );

    const normalizedBody = body.toLowerCase();
    if (['!ping', 'ping', '!teste', 'teste'].includes(normalizedBody)) {
        try {
            await message.reply(
                TEST_REPLY,
                undefined,
                message.fromMe ? { sendSeen: false } : {}
            );
        } catch (error) {
            console.error('Erro ao enviar mensagem de teste:', error);
        }
    }
};

// Mensagens recebidas de outros contatos (fromMe === false)
bot.on('message', handleTestMessage);

// Mensagens enviadas pelo próprio número conectado (ex.: chat consigo mesmo, fromMe === true)
bot.on('message_create', async (message) => {
    if (!message.fromMe) return;
    await handleTestMessage(message);
});

// Reutiliza o navegador já ativo via DevToolsActivePort para permitir scripts CLI simultâneos
async function tryAttachExistingBrowser() {
    const portFile = path.join(authDataPath, 'session-shima', 'DevToolsActivePort');
    if (!fs.existsSync(portFile)) return false;

    let browser = null;
    try {
        const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
        if (!port || !wsPath) return false;

        browser = await puppeteer.connect({
            browserWSEndpoint: `ws://127.0.0.1:${port}${wsPath}`,
            defaultViewport: null,
        });

        let waPage = null;
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            const pages = await browser.pages();
            waPage = pages.find((page) => page.url().includes('web.whatsapp.com'));
            if (waPage) break;
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (!waPage) {
            browser.disconnect();
            return false;
        }

        await waPage.waitForFunction(() => typeof window.WWebJS !== 'undefined', {
            timeout: 45000,
        });

        bot.pupBrowser = browser;
        bot.pupPage = waPage;
        bot.info = bot.info || { attached: true };
        isAttachedBrowser = true;
        isBotReady = true;
        console.log('Conectado à instância ativa do WhatsApp já em execução.');
        bot.emit('ready');
        return true;
    } catch (_) {
        if (browser) {
            try {
                browser.disconnect();
            } catch (_) {
                // Ignora erro ao desconectar instância inválida
            }
        }
        return false;
    }
}

/**
 * Aguarda até que o cliente do WhatsApp esteja pronto para enviar mensagens.
 * @param {number} [timeoutMs=60000] Tempo máximo de espera em milissegundos
 * @returns {Promise<void>}
 */
async function waitUntilBotReady(timeoutMs = 60000) {
    if (isBotReady && bot.info && bot.pupPage) return;

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new BaseError('Tempo esgotado aguardando o WhatsApp ficar pronto.', 504));
        }, timeoutMs);

        const onReady = () => {
            cleanup();
            resolve();
        };
        const onAuthFailure = (err) => {
            cleanup();
            reject(new BaseError(`Falha na autenticação do WhatsApp: ${err}`, 401));
        };
        const cleanup = () => {
            clearTimeout(timer);
            bot.off('ready', onReady);
            bot.off('auth_failure', onAuthFailure);
        };

        bot.once('ready', onReady);
        bot.once('auth_failure', onAuthFailure);

        if (initPromise) {
            initPromise.catch((err) => {
                cleanup();
                reject(err);
            });
        }
    });
}

/**
 * Encerra a conexão do cliente sem derrubar o navegador principal caso esteja anexado.
 * @returns {Promise<void>}
 */
async function disconnectBot() {
    isBotReady = false;
    if (isAttachedBrowser && bot.pupBrowser) {
        bot.pupBrowser.disconnect();
        return;
    }
    await bot.destroy();
}

// Encerra o navegador limpo ao parar o processo para não deixar SingletonLock preso
const gracefulShutdown = async () => {
    try {
        await disconnectBot();
    } catch (_) {
        // Ignora erros caso o navegador já tenha sido fechado
    }
    process.exit(0);
};

process.once('SIGINT', gracefulShutdown);
process.once('SIGTERM', gracefulShutdown);

async function startBot() {
    const attached = await tryAttachExistingBrowser();
    if (!attached) {
        await bot.initialize();
    }
}

initPromise = startBot().catch((error) => {
    console.error('Não foi possível iniciar o cliente do WhatsApp:', error);
    throw error;
});

module.exports = {
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
};
