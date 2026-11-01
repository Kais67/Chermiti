// Envoi d'e-mails (facultatif). Deux modes :
//  1. API HTTPS Brevo (BREVO_API_KEY + MAIL_FROM) : seul mode utilisable sur Render gratuit (SMTP bloqué)
//  2. SMTP classique (SMTP_HOST...) : hébergements qui autorisent les ports 465/587 ou usage local
let t=null;
const FROM=()=>process.env.MAIL_FROM||process.env.SMTP_FROM||process.env.SMTP_USER;
function transport(){if(t!==null)return t||null;if(!process.env.SMTP_HOST){t=false;return null}
 t=require('nodemailer').createTransport({host:process.env.SMTP_HOST,port:+(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined});return t}
const actif=()=>!!(process.env.BREVO_API_KEY||transport());
async function envoyer(to,subject,text){
 if(process.env.BREVO_API_KEY){
  if(!FROM())return{statut:'echec',detail:"MAIL_FROM manquant (adresse expéditeur validée chez Brevo)"};
  try{const r=await fetch(process.env.BREVO_API_URL||'https://api.brevo.com/v3/smtp/email',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'api-key':process.env.BREVO_API_KEY,'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({sender:{name:process.env.MAIL_FROM_NAME||'École Abou El Kacem Chebbi',email:FROM()},to:[{email:to}],subject,textContent:text})});
   if(!r.ok)return{statut:'echec',detail:`Brevo ${r.status} : ${(await r.text()).slice(0,200)}`};return{statut:'envoye'}}catch(e){return{statut:'echec',detail:e.message}}}
 const tr=transport();if(!tr)return{statut:'non_configure'};
 try{await tr.sendMail({from:FROM(),to,subject,text});return{statut:'envoye'}}catch(e){return{statut:'echec',detail:e.message}}}
module.exports={envoyer,actif};
