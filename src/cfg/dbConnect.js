import "dotenv/config.js";
import mongoose from "mongoose";
const MONGOKEY = process.env.MONGOKEY;

async function connectDatabase() {
  mongoose.connect(MONGOKEY);
  return mongoose.connection;
}
export default connectDatabase;
