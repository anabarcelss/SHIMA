import express from "express";
import UserController from "../controller/userController.js";

const routes = express.Router();

routes.post("/register", UserController.registerAuth);
routes.post("/login", UserController.loginUser);
routes.get("/register", UserController.getAllUsers);
export default routes;
