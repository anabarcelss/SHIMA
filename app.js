import express from "express";
import databaseConnect from "./src/cfg/dbConnect.js";
import routes from "./src/routes/index.js";

const app = express();
routes(app);

export default app;
