import jwt from 'jsonwebtoken'
import "dotenv/config.js";

const secret = process.env.JWTSECRET 

async function generateToken(userName) {
 let token =   jwt.sign({name:userName}, secret, {expiresIn:'3600s'})
 
    return token
}

async function tokenValidate(req,res,next) {
    const jwt = ['Authorization']
    try{
        jwt.verify()
    }catch(e){
        console.log(e)
    }
    
}

export {generateToken, tokenValidate}