import e from "express"
import databaseConnect from "../cfg/dbConnect.js"
class UserModel {
constructor(name,age,number, address){
this.name = name
this.age = age
this.number = number
this.address = address

}

async Create(){
  const sql = `INSERT INTO users(name,age, number, address) VALUES (?,?,?,?)`
  const values = [this.name, this.age, this.number, this.address]
  databaseConnect.query(sql,values,(e)=>{
    if(e)throw e
  })
}

async getAll(req,res){
  const sql = `SELECT * FROM users`
  databaseConnect.query(sql, (e, result)=>{
    if (e) throw e 
    res.send(result)
  })
}
}
export default UserModel