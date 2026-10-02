import express from "express";
import connectDatabase from "./src/cfg/dbConnect.js";
import routes from "./src/routes/index.js";

const connection = await connectDatabase();

connection.on("error", (erro) => {
  console.log("erro na conexão", erro);
});

connection.once("open", () => {
  console.log("Conectado com sucesso no DB");
});

const app = express();
routes(app);

export default app;
