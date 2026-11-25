// Integrando classes de erro personalizadas para encaminhamento ao middleware errorHandler via next()
const NotFound = require("../errors/NotFound.js");
const RequisicaoIncorreta = require("../errors/RequisicaoIncorreta.js");

class Controller{
    constructor(entityService){
        this.entityService = entityService
    }

    async getAll(req, res, next){
        try{
            const regList = await this.entityService.getAllRegistries()
            return res.status(200).json(regList)
        } catch(erro){
            // Encaminha erros inesperados para o middleware errorHandler
            next(erro)
        }
    }

    async getById(req, res, next){
        try{
            const registry = await this.entityService.getRegistryById(req.params.id)
            if(!registry){
                // Utiliza a classe NotFound (404) integrada ao middleware errorHandler
                return next(new NotFound("Registro não encontrado"))
            }
            return res.status(200).json(registry)
            
        } catch(erro){
            next(erro)
        }
    }

    // Adicionado createData no Controller base para atender às rotas POST de customer, menuItems e order
    async createData(req, res, next){
        const createData = req.body
        if(!createData || Object.keys(createData).length === 0){
            return next(new RequisicaoIncorreta("Dados para criação não fornecidos"))
        }
        try{
            const newRegistry = await this.entityService.createRegistry(createData)
            return res.status(201).json(newRegistry)
        } catch(erro){
            next(erro)
        }
    }

    async updateData(req, res, next){
        const {id} = req.params
        const updateData = req.body
        if(!updateData || Object.keys(updateData).length === 0){
            return next(new RequisicaoIncorreta())
        }
        try{
            const existing = await this.entityService.getRegistryById(Number(id))
            if(!existing){
                return next(new NotFound("Registro não encontrado"))
            }
            const update = await this.entityService.updateRegistry(updateData, Number(id))
            return res.status(200).json({msg: "Alterado com sucesso", update})
        } catch(erro){
            next(erro)
        }
    }

    // Adicionado deleteData no Controller base para atender às rotas de remoção padrão (customerRoutes, orderRoutes, menuItemRoutes)
    async deleteData(req, res, next){
        const { id } = req.params
        try{
            const deleted = await this.entityService.deleteRegistry(Number(id))
            if (!deleted) {
                return next(new NotFound(`ID ${id} não encontrado`))
            }
            return res.status(200).json({ msg: `ID ${id} deletado com sucesso` })
        } catch(erro){
            next(erro)
        }
    }
}
module.exports = Controller