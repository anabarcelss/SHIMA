import "dotenv/config.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
const registerSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.ObjectId },
    nome: { type: String, required: true },
    // email:{type:String, required:true},
    password: { type: String, required: true },
    telefone: { type: String, required: true },
  },
  { versionKey: false },
);
registerSchema.pre("save", async function (req, res) {
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (err) {
    throw new Error(err);
  }
});

const User = mongoose.model("usuarios", registerSchema);

export default User;
