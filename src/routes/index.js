const express = require("express");
const customerRoutes = require("./customerRoutes.js");
// Importadas as novas rotas de Order e Menu_item para anexá-las ao roteador principal
const orderRoutes = require("./orderRoutes.js");
const menuItemRoutes = require("./menuItemRoutes.js");

const routes = (app) => {
  app.route ("/").get((req, res) => {
    res.status(200).send("Shimã Sushi API");
  });
  // Anexadas orderRoutes e menuItemRoutes junto de customerRoutes no app.use
  app.use(express.json(), customerRoutes, orderRoutes, menuItemRoutes);
};

module.exports = routes;