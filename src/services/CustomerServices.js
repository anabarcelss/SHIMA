const Services = require("./Services.js");
const dataSource = require("../models");

class CustomerServices extends Services {
    constructor() {
        super('Customer');
    }

    // Exclui o campo password nas consultas públicas de clientes
    async getAllRegistries() {
        return dataSource[this.model].findAll({
            attributes: { exclude: ['password'] }
        });
    }

    // Exclui o campo password ao buscar cliente por ID
    async getRegistryById(id) {
        return dataSource[this.model].findByPk(id, {
            attributes: { exclude: ['password'] }
        });
    }

    // Busca cliente por email mantendo password para verificação de login e unicidade
    async getCustomerByEmail(email) {
        return dataSource[this.model].findOne({
            where: { email }
        });
    }
}

module.exports = CustomerServices;
