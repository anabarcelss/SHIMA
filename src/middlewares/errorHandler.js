const BaseError = require("../errors/BaseError.js");
const RequisicaoIncorreta = require("../errors/RequisicaoIncorreta.js");

function errorHandler(erro, req, res, next){
  // Captura códigos de erro MySQL diretos ou encapsulados pelo Sequelize (parent/original)
  const codigoErro = erro.code || erro.parent?.code || erro.original?.code;
  const requisicaoIncorretaCodigos =[
    "ER_TRUNCATED_WRONG_VALUE", // Tipo incompatível (ex: texto em coluna INT/DATE)
    "ER_BAD_FIELD_ERROR",       // Coluna informada não existe na tabela
    "ER_DATA_TOO_LONG",         // Texto excede o limite definido no VARCHAR
    "ER_BAD_NULL_ERROR",        // Campo obrigatório enviado como null
    "ER_NO_DEFAULT_FOR_FIELD",  // Campo obrigatório ausente na requisição
    "ER_NO_REFERENCED_ROW_2"    // Chave estrangeira informada não existe
  ];
  const sequelizeErros = [
    "SequelizeValidationError",
    "SequelizeUniqueConstraintError",
    "SequelizeForeignKeyConstraintError",
    "SequelizeDatabaseError"
  ];

  if(requisicaoIncorretaCodigos.includes(codigoErro) || sequelizeErros.includes(erro.name)){
    new RequisicaoIncorreta().sendResponse(res)
  }else if (erro instanceof BaseError){
    erro.sendResponse(res)
  } else{
    new BaseError().sendResponse(res)
  }
}
module.exports = errorHandler;