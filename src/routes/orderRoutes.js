const express = require("express");
const OrderController = require('../controller/OrderController.js');
const { tokenValidate } = require("../middlewares/jwToken.js");
const {
    validateIdParam,
    validateCreateOrderInput,
    validateUpdateOrderInput,
    validateDispatchOrderInput,
} = require("../middlewares/inputValidator.js");

const routes = express.Router();
const orderController = new OrderController();

routes.post("/pedidos/", tokenValidate, validateCreateOrderInput, (req, res, next) => orderController.createData(req, res, next));
routes.get("/pedidos/", tokenValidate, (req, res, next) => orderController.getAll(req, res, next));
routes.patch('/pedidos/despachar-ultimo', tokenValidate, validateDispatchOrderInput, (req, res, next) => orderController.dispatchLastOrder(req, res, next));
routes.patch('/pedidos/:id/despachar', tokenValidate, validateIdParam, validateDispatchOrderInput, (req, res, next) => orderController.dispatchOrderById(req, res, next));
routes.get("/pedidos/:id", validateIdParam, (req, res, next) => orderController.getById(req, res, next));
routes.get('/teste', (req, res, next) => orderController.getThisCustomerOrders(req, res, next));
routes.put('/pedidos/:id', validateIdParam, validateUpdateOrderInput, (req, res, next) => orderController.updateData(req, res, next));
routes.delete('/pedidos/:id', tokenValidate, validateIdParam, (req, res, next) => orderController.deleteData(req, res, next));

module.exports = routes;
