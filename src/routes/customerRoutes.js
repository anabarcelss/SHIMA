const express = require("express");
const CustomerController = require('../controller/CustomerController.js')
const { tokenValidate } = require("../middlewares/jwToken.js");
const routes = express.Router();
const customerController = new CustomerController()
// Rotas de autenticação e cadastro de clientes integradas ao bcrypt, JWT e errorHandler
routes.post("/register", (req, res, next) => customerController.registerCustomer(req, res, next));
routes.post('/login', (req, res, next) => customerController.customerLogin(req, res, next));
routes.post("/users/", (req, res, next) => customerController.registerCustomer(req, res, next));
routes.get("/users/", (req, res, next) => customerController.getAll(req, res, next));
routes.get("/users/:id", (req, res, next) => customerController.getById(req, res, next));
routes.put('/users/:id', (req, res, next) => customerController.updateData(req, res, next));
routes.delete('/users/:id', (req, res, next) => customerController.deleteData(req, res, next));
module.exports = routes;
