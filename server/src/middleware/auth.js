const jwt=require('jsonwebtoken');
const secret=()=>{if(!process.env.JWT_SECRET)throw new Error('JWT_SECRET manquant');return process.env.JWT_SECRET};
// « ec » = identifiant de l'école : un jeton émis pour une école est refusé par toutes les autres.
const sign=(u,ec='')=>jwt.sign({id:u.id,role:u.role==='directeur'?'admin':u.role,directeur:u.role==='directeur'||undefined,ec},secret(),{expiresIn:'8h'});
function auth(req,res,next){try{const p=jwt.verify((req.headers.authorization||'').replace('Bearer ',''),secret());
 if((p.ec||'')!==(req.ecole||''))throw new Error('école différente');req.user=p;next()}catch{res.status(401).json({erreur:'Non authentifié'})}}
// Le directeur dispose des droits de l'administrateur (pilotage, finances, pédagogie, BI) SAUF gestion des comptes utilisateurs et configuration technique.
const adminStrict=(req,res,next)=>req.user&&req.user.directeur?res.status(403).json({erreur:'Réservé à l\'administrateur de l\'établissement'}):next();
const roles=(...r)=>(req,res,next)=>r.includes(req.user.role)?next():res.status(403).json({erreur:'Accès refusé'});
module.exports={sign,auth,roles,adminStrict};
