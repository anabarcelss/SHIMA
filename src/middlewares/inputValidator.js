const RequisicaoIncorreta = require('../errors/RequisicaoIncorreta.js');

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ALLOWED_ORDER_STATUSES = [
    'Em preparo',
    'Pendente',
    'Confirmado',
    'Saiu para entrega',
    'Entregue',
    'Cancelado',
];

function isPlainObject(value) {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Date)
    );
}

// Remove propriedades perigosas para evitar prototype pollution
function stripDangerousKeys(obj) {
    if (!isPlainObject(obj)) return {};
    const clean = {};
    for (const key of Object.keys(obj)) {
        if (!DANGEROUS_KEYS.has(key)) {
            clean[key] = obj[key];
        }
    }
    return clean;
}

// Normaliza Unicode, remove bytes nulos, tags HTML/script e espaços excedentes
function sanitizeText(value) {
    if (typeof value !== 'string') return '';
    return value
        .normalize('NFC')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/javascript:/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function sanitizeEmail(value) {
    if (typeof value !== 'string') return '';
    return value
        .replace(/[\x00-\x1F\x7F]/g, '')
        .trim()
        .toLowerCase();
}

function sanitizePhone(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return '';
    let digits = String(value).replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('0')) {
        digits = digits.replace(/^0+/, '');
    }
    return digits;
}

function isValidEmail(email) {
    return (
        typeof email === 'string' &&
        email.length <= 254 &&
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
    );
}

function isValidBrazilPhone(digits) {
    if (typeof digits !== 'string' || !/^\d+$/.test(digits)) return false;
    let national = digits;
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        national = digits.slice(2);
    } else if (digits.length !== 10 && digits.length !== 11) {
        return false;
    }
    const ddd = Number(national.slice(0, 2));
    return ddd >= 11 && ddd <= 99;
}

function isValidPositiveInt(value) {
    if (typeof value === 'number') {
        return Number.isInteger(value) && value >= 1 && value <= 2147483647;
    }
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
        const num = Number(value.trim());
        return Number.isSafeInteger(num) && num >= 1 && num <= 2147483647;
    }
    return false;
}

function parseValidNumber(value) {
    if (typeof value === 'boolean' || (typeof value === 'object' && value !== null)) {
        return NaN;
    }
    if (typeof value === 'string' && !value.trim()) {
        return NaN;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
}

function parseOrderDate(value) {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
        return null;
    }
    if (typeof value === 'string' && !value.trim()) {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateNameField(name) {
    if (name.length < 2 || name.length > 120 || !/[a-zA-ZÀ-ÿ]/.test(name)) {
        return 'Nome inválido: informe entre 2 e 120 caracteres com letras';
    }
    return null;
}

function validatePasswordField(password) {
    if (
        typeof password !== 'string' ||
        password.includes('\0') ||
        password.length < 6 ||
        password.length > 72 ||
        password.trim().length < 6
    ) {
        return 'A senha deve ter entre 6 e 72 caracteres';
    }
    return null;
}

function validateAddressField(address) {
    if (address.length < 5 || address.length > 255) {
        return 'O endereço deve ter entre 5 e 255 caracteres';
    }
    return null;
}

// Valida parâmetros numéricos positivos na URL (:id)
function validateIdParam(req, res, next) {
    if (!isValidPositiveInt(req.params.id)) {
        return next(new RequisicaoIncorreta('ID inválido: informe um número inteiro positivo'));
    }
    req.params.id = String(Number(String(req.params.id).trim()));
    return next();
}

// Sanitiza e valida os dados de cadastro (/register e POST /users/)
function validateRegisterInput(req, res, next) {
    if (!isPlainObject(req.body)) {
        return next(new RequisicaoIncorreta('Dados para cadastro inválidos'));
    }

    const raw = stripDangerousKeys(req.body);
    const requiredTextFields = ['name', 'password', 'repeatPassword', 'email', 'address'];
    for (const field of requiredTextFields) {
        if (raw[field] !== undefined && typeof raw[field] !== 'string') {
            return next(new RequisicaoIncorreta(`Formato inválido para o campo ${field}`));
        }
    }
    if (raw.phone !== undefined && typeof raw.phone !== 'string' && typeof raw.phone !== 'number') {
        return next(new RequisicaoIncorreta('Formato inválido para o campo phone'));
    }

    const name = typeof raw.name === 'string' ? sanitizeText(raw.name) : '';
    const email = typeof raw.email === 'string' ? sanitizeEmail(raw.email) : '';
    const address = typeof raw.address === 'string' ? sanitizeText(raw.address) : '';
    const phone = raw.phone !== undefined ? sanitizePhone(raw.phone) : '';
    const password = typeof raw.password === 'string' ? raw.password : '';
    const repeatPassword = typeof raw.repeatPassword === 'string' ? raw.repeatPassword : '';

    if (!name || !password || !repeatPassword || !email || !address || !phone) {
        return next(
            new RequisicaoIncorreta(
                'Todos os campos obrigatórios (name, password, repeatPassword, email, address, phone) devem ser informados'
            )
        );
    }

    if (password !== repeatPassword) {
        return next(new RequisicaoIncorreta('As senhas não coincidem'));
    }

    const fieldError =
        validateNameField(name) ||
        (!isValidEmail(email) ? 'Formato de email inválido' : null) ||
        validatePasswordField(password) ||
        validateAddressField(address) ||
        (!isValidBrazilPhone(phone) ? 'Número de telefone inválido' : null);

    if (fieldError) {
        return next(new RequisicaoIncorreta(fieldError));
    }

    // Repassa apenas os campos esperados (impede mass assignment de role/id)
    req.body = { name, password, repeatPassword, email, address, phone };
    return next();
}

// Sanitiza e valida credenciais de login (POST /login)
function validateLoginInput(req, res, next) {
    if (req.body === undefined) {
        return next(new RequisicaoIncorreta('Email e senha são obrigatórios'));
    }
    if (!isPlainObject(req.body)) {
        return next(new RequisicaoIncorreta('Formato de credenciais inválido'));
    }

    const raw = stripDangerousKeys(req.body);
    if (
        (raw.email !== undefined && typeof raw.email !== 'string') ||
        (raw.password !== undefined && typeof raw.password !== 'string')
    ) {
        return next(new RequisicaoIncorreta('Formato de credenciais inválido'));
    }

    const email = raw.email ? sanitizeEmail(raw.email) : '';
    const password = raw.password || '';

    if (!email || !password) {
        return next(new RequisicaoIncorreta('Email e senha são obrigatórios'));
    }
    if (!isValidEmail(email)) {
        return next(new RequisicaoIncorreta('Formato de email inválido'));
    }
    if (password.includes('\0') || password.length > 128) {
        return next(new RequisicaoIncorreta('Senha inválida'));
    }

    req.body = { email, password };
    return next();
}

// Sanitiza e valida atualização de cliente (PUT /users/:id), bloqueando alterações de role/id
function validateCustomerUpdateInput(req, res, next) {
    if (!isPlainObject(req.body) || Object.keys(req.body).length === 0) {
        return next(new RequisicaoIncorreta());
    }

    const raw = stripDangerousKeys(req.body);
    const cleaned = {};

    if (raw.name !== undefined) {
        if (typeof raw.name !== 'string') {
            return next(new RequisicaoIncorreta('Formato inválido para o campo name'));
        }
        const name = sanitizeText(raw.name);
        const err = validateNameField(name);
        if (err) return next(new RequisicaoIncorreta(err));
        cleaned.name = name;
    }

    if (raw.email !== undefined) {
        if (typeof raw.email !== 'string') {
            return next(new RequisicaoIncorreta('Formato inválido para o campo email'));
        }
        const email = sanitizeEmail(raw.email);
        if (!isValidEmail(email)) {
            return next(new RequisicaoIncorreta('Formato de email inválido'));
        }
        cleaned.email = email;
    }

    if (raw.address !== undefined) {
        if (typeof raw.address !== 'string') {
            return next(new RequisicaoIncorreta('Formato inválido para o campo address'));
        }
        const address = sanitizeText(raw.address);
        const err = validateAddressField(address);
        if (err) return next(new RequisicaoIncorreta(err));
        cleaned.address = address;
    }

    if (raw.phone !== undefined) {
        if (typeof raw.phone !== 'string' && typeof raw.phone !== 'number') {
            return next(new RequisicaoIncorreta('Formato inválido para o campo phone'));
        }
        const phone = sanitizePhone(raw.phone);
        if (!isValidBrazilPhone(phone)) {
            return next(new RequisicaoIncorreta('Número de telefone inválido'));
        }
        cleaned.phone = phone;
    }

    if (raw.password !== undefined) {
        const err = validatePasswordField(raw.password);
        if (err) return next(new RequisicaoIncorreta(err));
        cleaned.password = raw.password;
    }

    if (Object.keys(cleaned).length === 0) {
        return next(new RequisicaoIncorreta('Nenhum dado válido informado para atualização'));
    }

    req.body = cleaned;
    return next();
}

// Sanitiza e valida os campos base do model Order (usado em criação e atualização)
function extractValidatedOrderFields(raw, { requireAllCoreFields }) {
    const cleaned = {};

    if (raw.customer_id !== undefined || requireAllCoreFields) {
        if (!isValidPositiveInt(raw.customer_id)) {
            return { error: 'customer_id deve ser um inteiro positivo' };
        }
        cleaned.customer_id = Number(String(raw.customer_id).trim());
    }

    if (raw.order_items_id !== undefined || requireAllCoreFields) {
        if (!isValidPositiveInt(raw.order_items_id)) {
            return { error: 'order_items_id deve ser um inteiro positivo' };
        }
        cleaned.order_items_id = Number(String(raw.order_items_id).trim());
    }

    if (raw.order_date !== undefined) {
        const parsedDate = parseOrderDate(raw.order_date);
        if (!parsedDate) {
            return { error: 'Data do pedido inválida' };
        }
        cleaned.order_date = parsedDate;
    } else if (requireAllCoreFields) {
        cleaned.order_date = new Date();
    }

    if (raw.total_amount !== undefined || requireAllCoreFields) {
        const total = parseValidNumber(raw.total_amount);
        if (Number.isNaN(total) || total <= 0 || total > 100000) {
            return { error: 'Valor total do pedido inválido' };
        }
        cleaned.total_amount = Number(total.toFixed(2));
    }

    if (raw.status !== undefined) {
        if (typeof raw.status !== 'string') {
            return { error: 'Status do pedido inválido' };
        }
        const status = sanitizeText(raw.status);
        if (!ALLOWED_ORDER_STATUSES.includes(status)) {
            return { error: 'Status do pedido inválido' };
        }
        cleaned.status = status;
    } else if (requireAllCoreFields) {
        cleaned.status = 'Em preparo';
    }

    return { cleaned };
}

function sanitizeOptionalAppOrderFields(raw, cleaned) {
    const textKeys = ['address', 'addressNumber', 'numero', 'customerName'];
    for (const key of textKeys) {
        if (raw[key] !== undefined) {
            if (typeof raw[key] !== 'string' && typeof raw[key] !== 'number') {
                return `Formato inválido para o campo ${key}`;
            }
            const sanitized = sanitizeText(String(raw[key]));
            if (sanitized) {
                cleaned[key] = sanitized.slice(0, 255);
            }
        }
    }

    for (const phoneKey of ['phone', 'customerPhone', 'customer_phone']) {
        if (raw[phoneKey] !== undefined) {
            if (typeof raw[phoneKey] !== 'string' && typeof raw[phoneKey] !== 'number') {
                return `Formato inválido para o campo ${phoneKey}`;
            }
            const phone = sanitizePhone(raw[phoneKey]);
            if (!isValidBrazilPhone(phone)) {
                return 'Número de telefone inválido';
            }
            cleaned[phoneKey] = phone;
        }
    }

    if (raw.estimatedTime !== undefined) {
        if (typeof raw.estimatedTime === 'number') {
            if (!Number.isFinite(raw.estimatedTime) || raw.estimatedTime <= 0 || raw.estimatedTime > 600) {
                return 'Tempo estimado inválido';
            }
            cleaned.estimatedTime = Math.round(raw.estimatedTime);
        } else if (typeof raw.estimatedTime === 'string') {
            const sanitized = sanitizeText(raw.estimatedTime);
            if (!sanitized || sanitized.length > 60) {
                return 'Tempo estimado inválido';
            }
            cleaned.estimatedTime = sanitized;
        } else {
            return 'Tempo estimado inválido';
        }
    }

    if (raw.deliveryFee !== undefined) {
        const fee = parseValidNumber(raw.deliveryFee);
        if (Number.isNaN(fee) || fee < 0 || fee > 10000) {
            return 'Taxa de entrega inválida';
        }
        cleaned.deliveryFee = Number(fee.toFixed(2));
    }

    if (raw.quantity !== undefined) {
        if (!isValidPositiveInt(raw.quantity)) {
            return 'Quantidade inválida';
        }
        cleaned.quantity = Number(String(raw.quantity).trim());
    }

    if (raw.items !== undefined) {
        if (typeof raw.items === 'string') {
            const sanitizedItems = sanitizeText(raw.items);
            if (!sanitizedItems) return 'Itens do pedido inválidos';
            cleaned.items = sanitizedItems;
        } else if (Array.isArray(raw.items)) {
            const sanitizedList = [];
            for (const item of raw.items) {
                if (typeof item === 'string') {
                    const txt = sanitizeText(item);
                    if (!txt) return 'Item do pedido inválido';
                    sanitizedList.push(txt);
                } else if (isPlainObject(item)) {
                    const itemName = sanitizeText(String(item.name || item.title || ''));
                    if (!itemName) return 'Nome do item do pedido inválido';
                    const nextItem = { name: itemName };
                    if (item.quantity !== undefined || item.qty !== undefined) {
                        const qty = item.quantity ?? item.qty;
                        if (!isValidPositiveInt(qty)) return 'Quantidade do item inválida';
                        nextItem.quantity = Number(String(qty).trim());
                    }
                    if (item.price !== undefined || item.unitPrice !== undefined) {
                        const price = parseValidNumber(item.price ?? item.unitPrice);
                        if (Number.isNaN(price) || price < 0 || price > 100000) {
                            return 'Preço do item inválido';
                        }
                        nextItem.price = Number(price.toFixed(2));
                    }
                    sanitizedList.push(nextItem);
                } else {
                    return 'Item do pedido inválido';
                }
            }
            cleaned.items = sanitizedList;
        } else {
            return 'Formato inválido para items';
        }
    }

    return null;
}

// Sanitiza e valida criação de pedidos (POST /pedidos/)
function validateCreateOrderInput(req, res, next) {
    if (!isPlainObject(req.body) || Object.keys(req.body).length === 0) {
        return next(new RequisicaoIncorreta('Dados para criação não fornecidos'));
    }

    const raw = stripDangerousKeys(req.body);
    const { cleaned, error } = extractValidatedOrderFields(raw, { requireAllCoreFields: true });
    if (error) {
        return next(new RequisicaoIncorreta(error));
    }

    const optionalError = sanitizeOptionalAppOrderFields(raw, cleaned);
    if (optionalError) {
        return next(new RequisicaoIncorreta(optionalError));
    }

    req.body = cleaned;
    return next();
}

// Sanitiza e valida atualização de pedidos (PUT /pedidos/:id)
function validateUpdateOrderInput(req, res, next) {
    if (!isPlainObject(req.body) || Object.keys(req.body).length === 0) {
        return next(new RequisicaoIncorreta());
    }

    const raw = stripDangerousKeys(req.body);
    const { cleaned, error } = extractValidatedOrderFields(raw, { requireAllCoreFields: false });
    if (error) {
        return next(new RequisicaoIncorreta(error));
    }

    if (Object.keys(cleaned).length === 0) {
        return next(new RequisicaoIncorreta('Nenhum dado válido informado para atualização do pedido'));
    }

    req.body = cleaned;
    return next();
}

// Sanitiza e valida dados opcionais enviados na liberação de entrega (PATCH /pedidos/.../despachar)
function validateDispatchOrderInput(req, res, next) {
    if (req.body === undefined || (isPlainObject(req.body) && Object.keys(req.body).length === 0)) {
        req.body = {};
        return next();
    }
    if (!isPlainObject(req.body)) {
        return next(new RequisicaoIncorreta('Dados para despacho inválidos'));
    }

    const raw = stripDangerousKeys(req.body);
    const cleaned = {};

    for (const key of ['courierName', 'delivererName']) {
        if (raw[key] !== undefined) {
            if (typeof raw[key] !== 'string') {
                return next(new RequisicaoIncorreta(`Formato inválido para ${key}`));
            }
            const sanitized = sanitizeText(raw[key]);
            if (sanitized) cleaned[key] = sanitized.slice(0, 120);
        }
    }

    if (raw.forceResend !== undefined) {
        if (typeof raw.forceResend !== 'boolean') {
            return next(new RequisicaoIncorreta('forceResend deve ser booleano'));
        }
        cleaned.forceResend = raw.forceResend;
    }

    const optionalError = sanitizeOptionalAppOrderFields(raw, cleaned);
    if (optionalError) {
        return next(new RequisicaoIncorreta(optionalError));
    }

    req.body = cleaned;
    return next();
}

module.exports = {
    stripDangerousKeys,
    sanitizeText,
    sanitizeEmail,
    sanitizePhone,
    validateIdParam,
    validateRegisterInput,
    validateLoginInput,
    validateCustomerUpdateInput,
    validateCreateOrderInput,
    validateUpdateOrderInput,
    validateDispatchOrderInput,
};
