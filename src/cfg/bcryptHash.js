import bcrypt from 'bcrypt'
import "dotenv/config.js";
const saltrounds = process.env.SALTROUNDS

async function EncryptPassword(pw){
        const salt = await bcrypt.genSalt(Number(saltrounds))
        const hash = await bcrypt.hash(pw, salt)
        return hash

}
async function ComparePassword(data, encriptedPassword) {

const result = await bcrypt.compare(data, encriptedPassword)
        return result   
}

export {EncryptPassword, ComparePassword}