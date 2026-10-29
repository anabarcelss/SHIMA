import databaseConnect from "../cfg/dbConnect.js";
import User from "../models/User.js";
import {generateToken, tokenValidate} from "../cfg/jwToken.js";
import {EncryptPassword, ComparePassword} from "../cfg/bcryptHash.js";
class UserController {
  static async customerLogin(req, res) {
    const email = req.body.email
    const sql = `SELECT password, email,name FROM users WHERE email = ?`
    try{
     databaseConnect.query(sql,email,async(e, response)=>{
      console.log(response[0])
        if(e) {console.log(e)
          return res.status(500).json({ msg: 'Erro interno no servidor' });
        }
      if(!response[0].email || response[0].email === null || !response[0].password ||response[0].password.lenght ===0){
       return  res.status(404).send('Email ou senha inválida')
      }
     

       const isMatchPassword = await ComparePassword(req.body.password, response[0].password)
          
         if(isMatchPassword)
        {
          const token = await generateToken(response[0].name)
          res.set('authorization', token)
         return  res.status(200).json({msg:"Tudo correto, Logando", token})
        }
        else
        {
         return res.status(400).json({msg: 'Erro na requisição, Senha ou email incorretos'})
        } 
      })

    } catch(e){
      console.log(e)
    }
  }
  static async registerAuth(req, res) {
    try {
      let { name,password, email, number, address } = req.body;
      if(!password) return res.status(400).send('Senha não inserida ou inválida' + password)
      password = await EncryptPassword(password)
      const user = new User(name, password, email, number, address  );
      await user.Create();
      res.status(200).json({ msg: `Usuário criado ${user.name} ${user.id}` });

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
