const jwt=require('jsonwebtoken');
const secret=()=>{if(!process.env.JWT_SECRET)throw new Error('JWT_SECRET manquant');return process.env.JWT_SECRET};
const sign=u=>jwt.sign({id:u.id,role:u.role},secret(),{expiresIn:'8h'});
function auth(req,res,next){try{req.user=jwt.verify((req.headers.authorization||'').replace('Bearer ',''),secret());next()}catch{res.status(401).json({erreur:'Non authentifié'})}}
const roles=(...r)=>(req,res,next)=>r.includes(req.user.role)?next():res.status(403).json({erreur:'Accès refusé'});
module.exports={sign,auth,roles};
