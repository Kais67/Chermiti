const crypto=require('crypto');
// Code d'authenticité d'un reçu : dépend du numéro, du montant et de la date (toute modification l'invalide)
const codeRecu=p=>crypto.createHmac('sha256',process.env.JWT_SECRET||'dev').update(`recu:${p.id}:${p.montant_millimes}:${p.date}`).digest('hex').slice(0,10).toUpperCase();
module.exports={codeRecu};
