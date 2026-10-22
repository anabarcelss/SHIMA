import express from "express";
import UserRoutes from "./userRoutes.js";

const routes = (app) => {
  app.route("/").get((req, res) => {
    res.status(200).send("Shimã Sushi API");
  });
  app.use(express.json(), UserRoutes);
};

export default routes;
