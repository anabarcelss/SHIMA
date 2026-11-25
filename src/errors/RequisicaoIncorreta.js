const BaseError = require("./BaseError.js");

class RequisicaoIncorreta extends BaseError{
    constructor(message = 'Um ou mais dados fornecidos estão incorretos'){
        super(message, 400)
    }
}
module.exports = RequisicaoIncorreta;