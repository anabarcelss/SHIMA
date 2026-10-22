import databaseConnect from "../cfg/dbConnect.js";
import User from "../models/User.js";
class UserController {
  static async isValidPassword(password) {
    try {
      // Compara a senha fornecida com o hash armazenado
      return await bcrypt.compare(password, this.password);
    } catch (error) {
      throw new Error("Falha na comparação da senha");
    }
  }
  static async registerAuth(req, res) {
    try {
      const { name, age, number, address } = req.body;
      const user = new User(name, age, number, address);
      await user.Create();
      res.status(200).json({ msg: `Usuário criado ${user.name}` });

      /*  const registerForm = await User.create(req.body);
      this.isValidPassword(req.body.password);
      res
        .status(201)
        .json({ msg: "Usuario criado com sucesso", user: registerForm }); */
    } catch (e) {
      res.status(500).json({ msg: `Erro ao criar usuario ${e.message}` });
    }
  }

  static async getAllUsers(req, res) {
    try {
      const sql = 'SELECT * FROM users'
      databaseConnect.query(sql, (e, result)=>{
    if (e) throw e 
    res.send(result)
  })
    } catch (e) {
      res.status(500).json({ msg: `erro na requisição ${e.message}` });
    }
  }

  static async getUserByID(req,res){
    const id = req.params.id
    try{
      const sql = `SELECT * FROM users WHERE id = ?`
      databaseConnect.query(sql,id, (e, result)=>{
        if(e) throw e
        res.status(200).json({result})
      })
    } catch(e){
      console.log(e.message)
    }
  }
  
  static async updateUser(req,res){
    const id = req.params.id
    const {name, number, address} = req.body
    const values = [
      name??null,
      number??null,
      address??null,
      id
    ]
    try{
      const sql = `UPDATE users SET 
      name=COALESCE(?, name), 
      number=COALESCE(?, number),
      address=COALESCE(?, address) 
      WHERE id = ?`
      databaseConnect.query(sql,values,(e, result)=>{
        if(e)throw e
        res.status(200).json({msg:'usuario atualizado com sucesso', result})
      })
    } catch(e){
      console.log(e.message)
    }
  }

/*   static async loginUser(req, res) {
    try {
      const login = await User.find({
        name: req.body.name,
        password: req.body.password,
      });
      if (!login) throw new Error("User not found");

      const isMatch = await isValidPassword(password);
      if (!isMatch) throw new Error("invalid Password");

      res.status(200).json({ msg: "Login Efetuado", user: login });
    } catch (e) {
      res.status(500).json({ msg: `Erro na requisição ${e.message}` });
    }
  } */

  static async deleteUser(req, res) {
    try {
      const id = req.params.id;
      const sql = `DELETE FROM users WHERE id = ${id}`
      databaseConnect.query(sql,(e)=>{
        if(e) throw e
        res.status(200).json({ msg: `Usuario deletado com sucesso` });
      })
    } catch (e) {
      res.status(500).json({ msg: `Erro ao deletar usuario ${e.message}` });
    }
  }

}

export default UserController;
