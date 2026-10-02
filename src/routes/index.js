import express from "express";
import register from "./authRoutes.js";

const routes = (app) => {
  app.route("/").get((req, res) => {
    res.status(200).send("Shimã Sushi API");
  });
  app.use(express.json(), register);
};

export default routes;
