import express from "express";
import routes from "./src/routes/index.js";

const app = express();
routes(app);

export default app;
