const express = require("express");
const CustomerController = require('../controller/CustomerController.js');
const {
    validateIdParam,
    validateRegisterInput,
    validateLoginInput,
    validateCustomerUpdateInput,
} = require("../middlewares/inputValidator.js");

const routes = express.Router();
const customerController = new CustomerController();

// Rotas de autenticação e cadastro de clientes com sanitização, validação, bcrypt, JWT e errorHandler
routes.post("/register", validateRegisterInput, (req, res, next) => customerController.registerCustomer(req, res, next));
routes.post('/login', validateLoginInput, (req, res, next) => customerController.customerLogin(req, res, next));
routes.post("/users/", validateRegisterInput, (req, res, next) => customerController.registerCustomer(req, res, next));
routes.get("/users/", (req, res, next) => customerController.getAll(req, res, next));
routes.get("/users/:id", validateIdParam, (req, res, next) => customerController.getById(req, res, next));
routes.put('/users/:id', validateIdParam, validateCustomerUpdateInput, (req, res, next) => customerController.updateData(req, res, next));
routes.delete('/users/:id', validateIdParam, (req, res, next) => customerController.deleteData(req, res, next));

module.exports = routes;
