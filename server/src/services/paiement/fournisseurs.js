// Connecteurs de paiement en ligne. Interface commune :
//   pret(secrets)                  → {ok, raison}   : identifiants présents ?
//   creer(secrets,mode,{…})        → {url, refExterne}
//   verifier(secrets,mode,ref)     → {statut:'paye'|'attente'|'echec', montant}   (toujours appelé côté serveur, jamais fondé sur le navigateur)
// « simule » : DEMO et mode SANDBOX n'encaissent AUCUN argent réel ; leurs paiements sont enregistrés comme TEST.
const err=(s,m)=>Object.assign(new Error(m),{status:s});
async function http(url,opt={}){
 let r;try{r=await fetch(url,{...opt,signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json',...(opt.headers||{})}})}catch(e){throw err(502,'Le service de paiement ne répond pas, réessayez dans un instant')}
 let j=null;try{j=await r.json()}catch{}
 if(!r.ok)throw err(502,'Le service de paiement a refusé la demande'+(j&&(j.message||(j.errors&&JSON.stringify(j.errors)))?' : '+(j.message||JSON.stringify(j.errors)):''));return j}

const demo={id:'demo',label:'DÉMONSTRATION (aucun argent réel)',reel:false,champs:[],
 pret:()=>({ok:true}),
 async creer(s,mode,{token}){return{url:'/paiement/'+token,refExterne:null}},
 async verifier(){return{statut:'attente'}}}; // la confirmation DEMO est faite par le parent sur la page de démonstration

const flouci={id:'flouci',label:'Flouci',reel:true,champs:['public','private'],
 base:()=>process.env.FLOUCI_BASE_URL||'https://developers.flouci.com/api/v2',
 pret:s=>s&&s.public&&s.private?{ok:true}:{ok:false,raison:'Clés Flouci (publique et privée) non renseignées'},
 auth:s=>({authorization:`Bearer ${s.public}:${s.private}`}),
 async creer(s,mode,{montant,successUrl,failUrl,webhookUrl,tracking}){
  const j=await http(this.base()+'/generate_payment',{method:'POST',headers:this.auth(s),body:JSON.stringify({amount:String(montant),success_link:successUrl,fail_link:failUrl,webhook:webhookUrl,developer_tracking_id:tracking,accept_card:true,session_timeout_secs:1800})});
  const r=j&&j.result;if(!r||!r.payment_id||!r.link)throw err(502,'Réponse Flouci inattendue');return{url:r.link,refExterne:r.payment_id}},
 async verifier(s,mode,ref){
  const j=await http(this.base()+'/verify_payment/'+encodeURIComponent(ref),{headers:this.auth(s)});
  if(!j||j.success!==true)return{statut:'attente'};const st=j.result&&j.result.status;
  return st==='SUCCESS'?{statut:'paye',montant:j.result.amount}:(['FAILURE','EXPIRED','SYSTEM_FAILURE'].includes(st)?{statut:'echec'}:{statut:'attente'})}};

const konnect={id:'konnect',label:'Konnect',reel:true,champs:['apiKey','walletId'],
 base:mode=>process.env.KONNECT_BASE_URL||(mode==='live'?'https://api.konnect.network/api/v2':'https://api.sandbox.konnect.network/api/v2'),
 pret:s=>s&&s.apiKey&&s.walletId?{ok:true}:{ok:false,raison:'Clé API et identifiant de portefeuille Konnect non renseignés'},
 async creer(s,mode,{montant,successUrl,failUrl,webhookUrl,tracking,description}){
  const j=await http(this.base(mode)+'/payments/init-payment',{method:'POST',headers:{'x-api-key':s.apiKey},body:JSON.stringify({receiverWalletId:s.walletId,token:'TND',amount:montant,type:'immediate',description,acceptedPaymentMethods:['wallet','bank_card','e-DINAR'],lifespan:30,checkoutForm:false,addPaymentFeesToAmount:false,orderId:tracking,webhook:webhookUrl,silentWebhook:true,successUrl,failUrl})});
  if(!j||!j.payUrl||!j.paymentRef)throw err(502,'Réponse Konnect inattendue');return{url:j.payUrl,refExterne:j.paymentRef}},
 async verifier(s,mode,ref){
  const j=await http(this.base(mode)+'/payments/'+encodeURIComponent(ref),{headers:{'x-api-key':s.apiKey}});
  const p=j&&(j.payment||j);const st=p&&p.status;
  return st==='completed'?{statut:'paye',montant:p.amount||(p.transactions&&p.transactions[0]&&p.transactions[0].amount)}:(['failed','expired'].includes(st)?{statut:'echec'}:{statut:'attente'})}};
module.exports={demo,flouci,konnect,tous:{demo,flouci,konnect},http};
