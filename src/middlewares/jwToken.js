const jwt = require("jsonwebtoken");
require("dotenv/config");
const BaseError = require("../errors/BaseError.js");

const secret = process.env.JWTSECRET;

async function generateToken(user) {
    const token = jwt.sign({ user }, secret, { expiresIn: '15m' });
    return token;
}

// Valida o token JWT encaminhando erros de autenticação ao middleware errorHandler
async function tokenValidate(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) {
        return next(new BaseError('Acesso negado.', 401));
    }
    try {
        const rawToken = token.startsWith("Bearer ") ? token.slice(7) : token;
        const decoded = jwt.verify(rawToken, secret);
        req.user = decoded;
        next();
    } catch (e) {
        return next(new BaseError('Token inválido ou expirado.', 401));
    }
}

module.exports = { generateToken, tokenValidate };