const express = require("express");
const MenuItemController = require('../controller/MenuItemController.js');
const { tokenValidate } = require("../middlewares/jwToken.js");
const routes = express.Router();
const menuItemController = new MenuItemController();

routes.post("/menu/", tokenValidate, (req, res, next) => menuItemController.createData(req, res, next));
routes.get("/menu/", (req, res, next) => menuItemController.getAll(req, res, next));
routes.get("/menu/:id", (req, res, next) => menuItemController.getById(req, res, next));
routes.put('/menu/:id', tokenValidate, (req, res, next) => menuItemController.updateData(req, res, next));
routes.delete('/menu/:id',tokenValidate, (req, res, next) => menuItemController.deleteData(req, res, next));

module.exports = routes;
