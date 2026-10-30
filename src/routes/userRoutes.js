import express from "express";
import UserController from "../controller/userController.js";
import {tokenValidate} from '../cfg/jwToken.js'
const routes = express.Router();

routes.post("/register", UserController.registerAuth);
routes.post('/login', UserController.customerLogin)
routes.get("/users", tokenValidate,UserController.getAllUsers);
routes.get("/user", tokenValidate ,UserController.getUserByID);
routes.put('/users/:id', UserController.updateUser)
routes.delete('/users/delete/:id', UserController.deleteUser)
export default routes;
