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
      const { nome, password, telefone } = req.body;
      const user = new User({ nome, password, telefone });
      await user.save();
      res.status(200).json({ msg: `Usuário criado ${user}` });

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
      const users = await User.find({});
      res.status(200).json(users);
    } catch (e) {
      res.status(500).json({ msg: `erro na requisição ${e.message}` });
    }
  }

  static async loginUser(req, res) {
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
  }

  static async deleteUser(req, res) {
    try {
      const id = req.params.id;
      const deletedUser = await User.findByIdAndDelete(id);
      res.status(200).json({ msg: `Usuario deletado com sucesso` });
    } catch (e) {
      res.status(500).json({ msg: `Erro ao deletar usuario ${e.message}` });
    }
  }
}

export default UserController;
