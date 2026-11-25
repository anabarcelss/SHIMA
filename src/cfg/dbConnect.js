require("dotenv/config");
const HOST = process.env.HOST || 'localhost'
const PORT = process.env.PORT || 3306;
const USERDB = process.env.USERDB
const PASSWORD = process.env.PASSWORD;
const DATABASE = process.env.DATABASE;
const mysql = require("mysql2");

const databaseConnect = mysql.createConnection({
  host:HOST,
  port: PORT,
  user: USERDB,
  password: PASSWORD,
  database : DATABASE
})
databaseConnect.connect((e)=>{
  if(e) throw e
  console.log('Connected to DataBase')
})
module.exports = databaseConnect;