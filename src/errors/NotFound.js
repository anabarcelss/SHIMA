const BaseError = require("./BaseError.js");

class NotFound extends BaseError{
    constructor(message = 'Página não encontrada'){
        super(message, 404)
    }
}
module.exports = NotFound;