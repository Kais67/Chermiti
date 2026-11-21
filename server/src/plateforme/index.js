// Routes plateforme (super-administrateur) et répartiteur de requêtes vers l'école concernée.
const express=require('express'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),{z}=require('zod');
const err=(s,m,code)=>Object.assign(new Error(m),{status:s,code});
const secret=()=>process.env.JWT_SECRET;
const signSA=a=>jwt.sign({id:a.id,role:'super_admin',ec:'*plateforme'},secret(),{expiresIn:'4h'});
const parse=(s,b)=>{const r=s.safeParse(b);if(!r.success)throw Object.assign(new Error('Données invalides'),{status:400,details:r.error.issues});return r.data};

function resolveSlug(req,defaut){
 const h=(req.headers['x-ecole']||req.query.ecole||'').toString().toLowerCase().trim();if(h)return h;
 const base=(process.env.BASE_DOMAIN||'').toLowerCase(),host=(req.hostname||'').toLowerCase();
 if(base&&host.endsWith('.'+base)){const sub=host.slice(0,-base.length-1);if(sub&&!sub.includes('.')&&sub!=='www')return sub}
 return defaut}

module.exports=function plateforme(tenants){
 const router=express.Router(),p=tenants.p;router.use(express.json());
 const login=new Map();
 router.post('/login',async(q,r)=>{const d=parse(z.object({email:z.string().email(),password:z.string().min(1)}),q.body);
  const a=(login.get(q.ip)||[]).filter(t=>Date.now()-t<9e5);if(a.length>=10)throw err(429,'Trop de tentatives, réessayez dans 15 minutes');
  const sa=await p.prepare('SELECT * FROM super_admins WHERE lower(email)=lower(?)').get(d.email.trim());
  if(!sa||!(await bcrypt.compare(d.password,sa.password_hash))){a.push(Date.now());login.set(q.ip,a);throw err(401,'Identifiants incorrects')}
  r.json({token:signSA(sa),admin:{id:sa.id,nom:sa.nom}})});
 const sa=(q,r,n)=>{try{const t=jwt.verify((q.headers.authorization||'').replace('Bearer ',''),secret());if(t.role!=='super_admin'||t.ec!=='*plateforme')throw 0;q.sa=t;n()}catch{r.status(401).json({erreur:'Non authentifié'})}};
 router.get('/ecoles',sa,async(q,r)=>r.json(await tenants.list()));
 router.post('/ecoles',sa,async(q,r)=>{const d=parse(z.object({slug:z.string(),nom:z.string().min(1),langue_defaut:z.enum(['fr','ar','en']).optional(),database_url:z.string().optional(),plan:z.enum(['essai','standard','premium']).optional(),fin_abonnement:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),contact:z.object({nom:z.string().optional(),email:z.string().email().optional()}).optional(),admin:z.object({email:z.string().email(),password:z.string().min(10),nom:z.string().optional()})}),q.body);
  r.status(201).json(await tenants.provision({slug:d.slug,nom:d.nom,langue:d.langue_defaut,databaseUrl:d.database_url,admin:d.admin,superAdminId:q.sa.id,plan:d.plan,finAbonnement:d.fin_abonnement,contact:d.contact}))});
 router.put('/ecoles/:slug',sa,async(q,r)=>{const d=parse(z.object({nom:z.string().min(1).optional(),statut:z.enum(['active','suspendue','archivee']).optional(),langue_defaut:z.enum(['fr','ar','en']).optional(),
   plan:z.enum(['essai','standard','premium']).optional(),fin_abonnement:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),contact_nom:z.string().max(120).nullable().optional(),contact_email:z.string().email().nullable().optional()}),q.body),e=await tenants.find(q.params.slug);
  if(!e)throw err(404,'École introuvable');const k=Object.keys(d);if(k.length)await p.prepare(`UPDATE ecoles SET ${k.map(x=>x+'=?').join(',')} WHERE slug=?`).run(...k.map(x=>d[x]),e.slug);
  if(d.statut&&d.statut!=='active'||d.nom)await tenants.invalidate(e.slug);await tenants.audit(q.sa.id,'modifier_ecole',e.slug,d);r.json({ok:true})});
 // Mot de passe temporaire pour l'administrateur d'une école (oubli) : affiché une seule fois
 router.post('/ecoles/:slug/reinitialiser-admin',sa,async(q,r)=>{const t=await tenants.get(q.params.slug);if(!t)throw err(404,'École introuvable');
  const d=parse(z.object({email:z.string().email().optional()}),q.body||{});
  const u=d.email?await t.db.prepare("SELECT id,email FROM users WHERE lower(email)=lower(?) AND role='admin' AND deleted_at IS NULL").get(d.email):await t.db.prepare("SELECT id,email FROM users WHERE role='admin' AND deleted_at IS NULL ORDER BY id").get();
  if(!u)throw err(404,'Aucun administrateur trouvé dans cette école');
  const mdp=require('crypto').randomBytes(9).toString('base64').replace(/[+/=]/g,'x')+'#7';await t.db.prepare('UPDATE users SET password_hash=?,mdp_temporaire=1 WHERE id=?').run(await bcrypt.hash(mdp,12),u.id);
  await tenants.audit(q.sa.id,'reinitialiser_admin',q.params.slug,{email:u.email});r.json({email:u.email,mot_de_passe_temporaire:mdp})});
 router.get('/ecoles/:slug/stats',sa,async(q,r)=>{const t=await tenants.get(q.params.slug);if(!t)throw err(404,'École introuvable');const c=s=>t.db.prepare(s).get();
  r.json({utilisateurs:(await c('SELECT COUNT(*) n FROM users WHERE deleted_at IS NULL')).n,eleves:(await c('SELECT COUNT(*) n FROM eleves WHERE deleted_at IS NULL')).n,classes:(await c('SELECT COUNT(*) n FROM classes WHERE deleted_at IS NULL')).n,paiements:(await c('SELECT COUNT(*) n FROM paiements WHERE deleted_at IS NULL')).n})});
 router.post('/ecoles/:slug/migrer',sa,async(q,r)=>{await tenants.invalidate(q.params.slug);const t=await tenants.get(q.params.slug);if(!t)throw err(404,'École introuvable');await tenants.audit(q.sa.id,'migrer_ecole',q.params.slug);r.json({ok:true})});
 router.use((e,q,r,n)=>{if(!e.status||e.status>=500)console.error('[PLATEFORME]',e);r.status(e.status||500).json({erreur:e.status?e.message:'Erreur interne',code:e.code,details:e.details})});
 return router};

// Répartiteur : choisit l'école de la requête puis délègue à son application
module.exports.dispatcher=function dispatcher(tenants){
 return async(req,res,next)=>{
  try{
   if(!req.path.startsWith('/api/'))return next();
   if(req.path==='/api/public/ecoles'&&req.method==='GET'){if(process.env.DEMO_ECOLES!=='true'&&process.env.PUBLIC_ECOLES_LIST!=='true')return res.json([]);return res.json((await tenants.list()).filter(e=>e.statut==='active').map(e=>({slug:e.slug,nom:e.nom})))}
   let defaut=process.env.DEFAULT_ECOLE_SLUG||'';
   if(!defaut&&process.env.ECOLE_UNIQUE_PAR_DEFAUT!=='false'){const l=(await tenants.list()).filter(e=>e.statut==='active');if(l.length===1)defaut=l[0].slug}
   const slug=resolveSlug(req,defaut);
   if(!slug)return res.status(400).json({erreur:"École non précisée : indiquez le code de l'école",code:'ECOLE_REQUISE'});
   const row=await tenants.find(slug);
   if(!row)return res.status(404).json({erreur:"École inconnue : vérifiez le code",code:'ECOLE_INCONNUE'});
   if(row.statut==='active'&&row.fin_abonnement&&row.fin_abonnement<new Date().toISOString().slice(0,10))return res.status(403).json({erreur:"L'abonnement de cet établissement a expiré. Contactez l'administration de la plateforme.",code:'ABONNEMENT_EXPIRE'});
   if(row.statut!=='active')return res.status(403).json({erreur:"Cet établissement est temporairement indisponible",code:'ECOLE_SUSPENDUE'});
   if(req.path==='/api/public/ecole'&&req.method==='GET')return res.json({slug:row.slug,nom:row.nom,langue_defaut:row.langue_defaut,plan:row.plan});
   const t=await tenants.get(slug);req.ecole=slug;t.app(req,res,next)
  }catch(e){next(e)}}};
module.exports.resolveSlug=resolveSlug;
