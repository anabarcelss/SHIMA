import express from "express";

const app = express();
const router = express.Router();

app.get("/", (req, res) => {
  res.status(200).send("Server rodando");
});

app.listen(3000, () => {
  console.log("ligou");
});
