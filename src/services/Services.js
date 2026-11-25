const dataSource = require('../models')

class Services {
    constructor(modelName){
        this.model = modelName
    }
    
    async getAllRegistries(){
        return dataSource[this.model].findAll()
    }
    async getRegistryById(id){
        return dataSource[this.model].findByPk(id)
    }
    async createRegistry(registryData){
        return dataSource[this.model].create(registryData)

    }
    async updateRegistry(updatedData, id){
        const updatedRegistryData = await dataSource[this.model].update(updatedData, {
            where: {id:id}
        })
        if(updatedRegistryData[0] === 0 ){
            return false
        } 
        return true


    }
    async deleteRegistry(id){
        return dataSource[this.model].destroy({where: {id:id}})
    }
}
module.exports = Services