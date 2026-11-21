// Configuration des fournisseurs par école (table config_paiement, secrets chiffrés) + règles de sûreté DEMO.
const{encrypt,decrypt}=require('../../lib/secret'),F=require('./fournisseurs');
const prodReelle=()=>process.env.NODE_ENV==='production'&&process.env.ALLOW_DEMO_SEED!=='true';
// La DÉMO n'est jamais disponible en production réelle, sauf PAIEMENT_EN_LIGNE=simulation explicite.
const demoAutorisee=()=>process.env.PAIEMENT_EN_LIGNE==='desactive'?false:(process.env.PAIEMENT_EN_LIGNE==='simulation'||!prodReelle());
function lire(row){try{return row&&row.secrets?JSON.parse(decrypt(row.secrets)):{}}catch{return{}}}
async function etat(db){
 const rows=Object.fromEntries((await db.prepare('SELECT * FROM config_paiement').all()).map(r=>[r.fournisseur,r]));
 const out=[];
 for(const f of Object.values(F.tous)){
  const r=rows[f.id],secrets=lire(r);
  if(f.id==='flouci'&&!secrets.public&&process.env.FLOUCI_PUBLIC_KEY){secrets.public=process.env.FLOUCI_PUBLIC_KEY;secrets.private=process.env.FLOUCI_PRIVATE_KEY}
  if(f.id==='konnect'&&!secrets.apiKey&&process.env.KONNECT_API_KEY){secrets.apiKey=process.env.KONNECT_API_KEY;secrets.walletId=process.env.KONNECT_WALLET_ID}
  const mode=f.id==='demo'?'demo':(r?r.mode:'sandbox');
  let actif=f.id==='demo'?demoAutorisee():!!(r&&r.actif===1);
  const p=f.pret(secrets);if(actif&&!p.ok)actif=false;
  out.push({id:f.id,label:f.label,mode,simule:f.id==='demo'||mode==='sandbox',actif,pret:p.ok,raison:p.ok?null:p.raison,secretsDefinis:Object.fromEntries(f.champs.map(c=>[c,!!secrets[c]])),_secrets:secrets})}
 return out}
// Version publique (aucun secret)
const publique=l=>l.map(({_secrets,...x})=>x);
async function defaut(db){const l=await etat(db);return l.find(x=>x.id!=='demo'&&x.actif)||l.find(x=>x.id==='demo'&&x.actif)||null}
async function sauver(db,id,{actif,mode,secrets}){
 const f=F.tous[id];if(!f||id==='demo')throw Object.assign(new Error('Fournisseur inconnu'),{status:400});
 const cur=(await db.prepare('SELECT * FROM config_paiement WHERE fournisseur=?').get(id));const s={...lire(cur)};
 for(const c of f.champs)if(secrets&&typeof secrets[c]==='string'&&secrets[c].trim())s[c]=secrets[c].trim();
 if(actif&&!f.pret(s).ok)throw Object.assign(new Error(f.pret(s).raison),{status:400});
 const vals=[actif?1:0,mode||(cur?cur.mode:'sandbox'),encrypt(JSON.stringify(s))];
 if(cur)await db.prepare("UPDATE config_paiement SET actif=?,mode=?,secrets=?,updated_at=datetime('now') WHERE fournisseur=?").run(...vals,id);
 else await db.prepare('INSERT INTO config_paiement(actif,mode,secrets,fournisseur) VALUES(?,?,?,?)').run(...vals,id)}
module.exports={etat,publique,defaut,sauver,demoAutorisee,prodReelle,F};
