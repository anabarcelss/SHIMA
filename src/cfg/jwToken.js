import jwt from 'jsonwebtoken'
import "dotenv/config.js";

const secret = process.env.JWTSECRET 

async function generateToken(name) {
 let token =   jwt.sign({name}, secret, {expiresIn:'15m'})
 
    return token
}

async function tokenValidate(req,res,next) {
    const token = req.headers['authorization']
    if(!token){
        return res.status(401).json({msg:'Acesso negado.'})
    }
    try{
        const decoded = jwt.verify(token.slice(7), secret)
req.user = decoded
next()
            }catch(e){
                return res.status(401).json({msg:'Token inválido ou expirado.', e:e.message})
            }
    
}

export {generateToken, tokenValidate}