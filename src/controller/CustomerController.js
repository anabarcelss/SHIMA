const Controller = require('./Controller.js');
const CustomerServices = require("../services/CustomerServices.js");
const { EncryptPassword, ComparePassword } = require("../cfg/bcryptHash.js");
const { generateToken } = require("../middlewares/jwToken.js");
const NotFound = require("../errors/NotFound.js");
const RequisicaoIncorreta = require("../errors/RequisicaoIncorreta.js");

const customerServices = new CustomerServices();

class CustomerController extends Controller {
    constructor() {
        super(customerServices);
    }

    // Registra um novo cliente criptografando a senha com bcrypt e validando duplicidade de email
    async registerCustomer(req, res, next) {
        const { name, password, repeatPassword, email, address, phone } = req.body;

        if (!name || !password || !repeatPassword || !email || !address || !phone) {
            return next(new RequisicaoIncorreta("Todos os campos obrigatórios (name, password, repeatPassword, email, address, phone) devem ser informados"));
        }
        if(password !== repeatPassword){
            return next(new RequisicaoIncorreta('As senhas não coincidem'))
        }
        try {
            const existingCustomer = await this.entityService.getCustomerByEmail(email);
            if (existingCustomer) {
                return next(new RequisicaoIncorreta("Email já cadastrado"));
            }

            const hashedPassword = await EncryptPassword(password);
            // Todos os usuários cadastrados recebem role padrão 'user'
            const newCustomer = await this.entityService.createRegistry({
                name,
                password: hashedPassword,
                email,
                address,
                phone,
                role: 'user'
            });

            const { password: _, ...userWithoutPassword } = newCustomer.toJSON();
            return res.status(201).json({
                msg: "Usuário criado com sucesso",
                user: userWithoutPassword
            });
        } catch (erro) {
            next(erro);
        }
    }

    // Autentica o cliente comparando a senha com bcrypt e retornando o token JWT
    async customerLogin(req, res, next) {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return next(new RequisicaoIncorreta("Email e senha são obrigatórios"));
        }

        try {
            const customer = await this.entityService.getCustomerByEmail(email);
            if (!customer || !customer.password) {
                return next(new NotFound("Usuário não encontrado"));
            }

            const isMatchPassword = await ComparePassword(password, customer.password);
            if (!isMatchPassword) {
                return next(new RequisicaoIncorreta("Erro na requisição, senha ou email incorretos"));
            }

            const token = await generateToken({ id: customer.id, email: customer.email, role: customer.role });
            res.set("authorization", token);
            return res.status(200).json({ msg: "Tudo correto, Logando", token });
        } catch (erro) {
            next(erro);
        }
    }

    // Garante validação de duplicidade de email e criptografia de senha ao atualizar cliente
    async updateData(req, res, next) {
        try {
            if (req.body && req.body.email) {
                const existingCustomer = await this.entityService.getCustomerByEmail(req.body.email);
                if (existingCustomer && existingCustomer.id !== Number(req.params.id)) {
                    return next(new RequisicaoIncorreta("Email já cadastrado"));
                }
            }
            if (req.body && req.body.password) {
                req.body.password = await EncryptPassword(req.body.password);
            }
            return super.updateData(req, res, next);
        } catch (erro) {
            next(erro);
        }
    }
}

module.exports = CustomerController;
