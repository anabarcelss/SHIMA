const express = require("express");
const OrderController = require('../controller/OrderController.js');
const { tokenValidate } = require("../middlewares/jwToken.js");
const routes = express.Router();
const orderController = new OrderController();

routes.post("/pedidos/",tokenValidate, (req, res, next) => orderController.createData(req, res, next));
routes.get("/pedidos/", tokenValidate,(req, res, next) => orderController.getAll(req, res, next));
routes.patch('/pedidos/despachar-ultimo', tokenValidate, (req, res, next) => orderController.dispatchLastOrder(req, res, next));
routes.patch('/pedidos/:id/despachar', tokenValidate, (req, res, next) => orderController.dispatchOrderById(req, res, next));
routes.get("/pedidos/:id",  (req, res, next) => orderController.getById(req, res, next));
routes.get('/teste',  (req,res,next)=> orderController.getThisCustomerOrders(req,res,next))
routes.put('/pedidos/:id', (req, res, next) => orderController.updateData(req, res, next));
routes.delete('/pedidos/:id', tokenValidate,(req, res, next) => orderController.deleteData(req, res, next));

module.exports = routes;