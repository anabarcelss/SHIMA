import express from "express";
import UserController from "../controller/userController.js";

const routes = express.Router();

routes.post("/register", UserController.registerAuth);
routes.post('/login/', UserController.customerLogin)
routes.get("/users", UserController.getAllUsers);
routes.get("/users/:id", UserController.getUserByID);
routes.put('/users/:id', UserController.updateUser)
routes.delete('/users/delete/:id', UserController.deleteUser)
export default routes;
