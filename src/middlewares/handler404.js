const NotFound = require("../errors/NotFound.js");

function handler404(req, res, next){
    const error404 = new NotFound()
    next(error404)
}

module.exports = handler404;