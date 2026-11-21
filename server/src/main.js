// Assemblage du serveur multi-écoles : PlatformDB + répartiteur + client web.
const path=require('path'),fs=require('fs'),express=require('express'),helmet=require('helmet'),bcrypt=require('bcryptjs');
const{Tenants,openPlatform}=require('./plateforme/tenants'),plateforme=require('./plateforme');
// Super-administrateur de la plateforme. SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD créent le compte au premier démarrage (aucun existant).
// Mot de passe perdu : ajouter SUPER_ADMIN_FORCE_RESET=true (avec le nouveau SUPER_ADMIN_PASSWORD), redémarrer, puis RETIRER cette variable.
async function bootstrapSuperAdmin(p){
 const e=(process.env.SUPER_ADMIN_EMAIL||'').trim(),pw=process.env.SUPER_ADMIN_PASSWORD;if(!e||!pw)return;
 const n=(await p.prepare('SELECT COUNT(*) n FROM super_admins').get()).n,force=process.env.SUPER_ADMIN_FORCE_RESET==='true';
 if(n>0&&!force)return;
 if(pw.length<10)return console.error('SUPER_ADMIN_PASSWORD : 10 caractères minimum, super-administrateur non créé');
 const h=await bcrypt.hash(pw,12),ex=await p.prepare('SELECT id FROM super_admins WHERE lower(email)=lower(?)').get(e);
 if(ex){await p.prepare('UPDATE super_admins SET password_hash=? WHERE id=?').run(h,ex.id);console.log('Mot de passe du super-administrateur réinitialisé :',e,'— retirez maintenant SUPER_ADMIN_FORCE_RESET')}
 else{await p.prepare('INSERT INTO super_admins(email,password_hash,nom) VALUES(?,?,?)').run(e,h,'Super administrateur');console.log('Super-administrateur créé :',e)}}
// CORS pour l'application Android (WebView : https://localhost) et d'éventuels clients autorisés (CORS_ORIGINS=https://a.tn,https://b.tn)
const ORIGINES=new Set(['https://localhost','capacitor://localhost','http://localhost',...(process.env.CORS_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean)]);
function cors(q,r,n){const o=q.headers.origin;
 if(o&&ORIGINES.has(o)){r.setHeader('Access-Control-Allow-Origin',o);r.setHeader('Vary','Origin');r.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Ecole');r.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');r.setHeader('Access-Control-Expose-Headers','Content-Disposition');r.setHeader('Access-Control-Max-Age','600')}
 if(q.method==='OPTIONS'&&q.path.startsWith('/api/'))return r.sendStatus(204);n()}
// DEMO_ECOLES=true : crée (si absentes) deux écoles de démonstration complètes — 6 profils chacune — avec un jeu de données fictif (voir docs/demo_comptes.md)
async function seedDemoEcoles(tenants){
 const{seedEcole,ECOLES}=require('../scripts/seed-demo');
 for(const e of ECOLES){if(await tenants.find(e.slug))continue;
  await tenants.provision({slug:e.slug,nom:e.nom,langue:e.langue,admin:{email:`admin.${e.code}@demo.tn`,password:e.password,nom:'Administrateur '+e.code.toUpperCase()}});
  const t=await tenants.get(e.slug);const r=await seedEcole(t.db,{code:e.code,nomEcole:e.nom,password:e.password,seed:e.seed,adminEmail:`admin.${e.code}@demo.tn`});console.log('École de démonstration créée :',e.slug,'(',r.eleves,'élèves )')}}
async function createServer({platformTarget}={}){
 const platform=await openPlatform(platformTarget),tenants=new Tenants(platform);
 const demoEcoles=process.env.DEMO_ECOLES==='true';
 const def=demoEcoles?null:await tenants.ensureDefault();if(def)console.log('École existante enregistrée dans PlatformDB :',def);
 await bootstrapSuperAdmin(platform);
 if(demoEcoles)await seedDemoEcoles(tenants);
 if(process.env.ALLOW_DEMO_SEED==='true'&&!demoEcoles){ // démonstration sans disque persistant : recrée les données fictives si l'école par défaut est vide
  const l=await tenants.list(),slug=process.env.DEFAULT_ECOLE_SLUG||(l[0]&&l[0].slug);
  if(slug){const t=await tenants.get(slug);if(t&&(await t.db.prepare('SELECT COUNT(*) n FROM users').get()).n===0)await require('../scripts/seed').seed(t.db)}}
 const app=express();app.set('trust proxy',process.env.TRUST_PROXY?+process.env.TRUST_PROXY:false);
 app.use(cors);
 app.get('/api/sante',async(q,r)=>{try{await platform.prepare('SELECT 1 n').get();r.json({ok:true,plateforme:platform.driver})}catch{r.status(503).json({ok:false})}});
 app.use('/api/plateforme',plateforme(tenants));
 app.use(plateforme.dispatcher(tenants));
 const dist=path.join(__dirname,'../../client/dist');
 if(fs.existsSync(dist)){app.use(helmet({contentSecurityPolicy:false}));app.use(express.static(dist));app.use((q,r,n)=>q.method==='GET'&&!q.path.startsWith('/api')&&!/\.[a-z0-9]+$/i.test(q.path)?r.sendFile(path.join(dist,'index.html')):n())}
 app.use((e,q,r,n)=>{if(!e.status||e.status>=500)console.error('[ERREUR]',q.method,q.originalUrl,e);r.status(e.status||500).json({erreur:e.status?e.message:'Erreur interne',code:e.code})});
 return{app,platform,tenants}}
module.exports={createServer,bootstrapSuperAdmin};
