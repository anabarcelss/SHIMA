const express = require("express");
const routes = require("./src/routes/index.js");
const errorHandler = require("./src/middlewares/errorHandler.js");
const handler404 = require("./src/middlewares/handler404.js");
const app = express();
routes(app);
app.use(handler404)
app.use(errorHandler)
module.exports = app;