const express=require('express'),helmet=require('helmet'),bcrypt=require('bcryptjs'),{z}=require('zod');
const{auth,roles,sign}=require('./middleware/auth'),{moyennes}=require('./services/grades'),pay=require('./services/payments');
try{z.config(z.locales.fr())}catch{}
module.exports=function(db){
 const app=express();app.set('trust proxy',process.env.TRUST_PROXY?+process.env.TRUST_PROXY:false);app.use(helmet({contentSecurityPolicy:{useDefaults:true,directives:{"upgrade-insecure-requests":null,"img-src":["'self'","data:","blob:"]}}}),express.json());const hits=new Map();app.use('/api/auth/login',(q,r,n)=>{const now=Date.now(),a=(hits.get(q.ip)||[]).filter(t=>now-t<9e5);if(a.length>=20)return r.status(429).json({erreur:'Trop de tentatives échouées, réessayez dans 15 minutes'});n()});const hp=new Map();app.post('/api/public/preinscriptions',(q,r,n)=>{const now=Date.now(),a=(hp.get(q.ip)||[]).filter(t=>now-t<36e5);if(a.length>=10)return r.status(429).json({erreur:'Trop de demandes depuis cette adresse, réessayez plus tard'});a.push(now);hp.set(q.ip,a);n()});
 const audit=(u,e,id,a,o,n)=>db.prepare('INSERT INTO audit_log(user_id,entite,entite_id,action,anciennes,nouvelles) VALUES(?,?,?,?,?,?)').run(u,e,id,a,o&&JSON.stringify(o),n&&JSON.stringify(n));
 const parse=(s,b)=>{const r=s.safeParse(b);if(!r.success)throw Object.assign(new Error('Données invalides'),{status:400,details:r.error.issues});return r.data};
 app.post('/api/auth/login',async(req,res,next)=>{try{const{email,password}=parse(z.object({email:z.string().email(),password:z.string().min(1)}),req.body);
  const u=db.prepare('SELECT * FROM users WHERE lower(email)=lower(?) AND deleted_at IS NULL').get(email.trim());
  if(!u||!(await bcrypt.compare(password,u.password_hash))){const a=hits.get(req.ip)||[];a.push(Date.now());hits.set(req.ip,a);return res.status(401).json({erreur:'Identifiants incorrects'})}
  res.json({token:sign(u),user:{id:u.id,nom:u.nom,role:u.role,mdp_temporaire:!!u.mdp_temporaire}})}catch(e){next(e)}});
 app.put('/api/auth/mot-de-passe',auth,async(req,res,next)=>{try{const d=parse(z.object({ancien:z.string().min(1),nouveau:z.string().min(8)}),req.body);const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if(!u||!(await bcrypt.compare(d.ancien,u.password_hash)))return res.status(400).json({erreur:'Mot de passe actuel incorrect'});if(d.ancien===d.nouveau)return res.status(400).json({erreur:'Le nouveau mot de passe doit être différent'});
  db.prepare('UPDATE users SET password_hash=?,mdp_temporaire=0 WHERE id=?').run(await bcrypt.hash(d.nouveau,10),u.id);audit(u.id,'users',u.id,'mot_de_passe');res.json({ok:true})}catch(e){next(e)}});
 app.get('/api/auth/moi',auth,(q,r)=>{const u=db.prepare('SELECT id,nom,role,mdp_temporaire FROM users WHERE id=? AND deleted_at IS NULL').get(q.user.id);u?r.json(u):r.status(401).json({erreur:'Session expirée'})});
 // Élèves : CRUD + archivage (soft delete) + audit
 const eleveS=z.object({nom:z.string().min(1),prenom:z.string().min(1),date_naissance:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const b=new Date(s+'T00:00:00');if(isNaN(b))return false;const a=(Date.now()-b.getTime())/31557600000;return a>=3&&a<=18},"Date de naissance invalide (l'élève doit avoir entre 3 et 18 ans)"),classe_id:z.number().int().nullable().optional(),annee_entree:z.string(),annee_scolaire:z.string(),antecedents_medicaux:z.string().optional()});
 app.get('/api/eleves',auth,(req,res)=>{const{id,role}=req.user;
  const sql={admin:'',comptable:'',enseignant:' AND classe_id IN(SELECT id FROM classes WHERE titulaire_id=? AND deleted_at IS NULL UNION SELECT classe_id FROM creneaux WHERE enseignant_id=? UNION SELECT classe_id FROM affectations WHERE enseignant_id=?)',parent:' AND id IN(SELECT eleve_id FROM parent_eleve WHERE parent_id=?)',eleve:' AND user_id=?'}[role];
  if(sql===undefined)return res.status(403).json({erreur:'Accès refusé'});
  res.json(db.prepare('SELECT * FROM eleves WHERE deleted_at IS NULL'+sql).all(...Array(sql.split('?').length-1).fill(id)).map(e=>role==='comptable'?{...e,antecedents_medicaux:undefined}:e))});
 app.post('/api/eleves',auth,roles('admin','comptable'),(req,res)=>{const d=parse(eleveS,req.body);
  if(d.classe_id){const c=db.prepare('SELECT capacite,(SELECT COUNT(*) FROM eleves WHERE classe_id=classes.id AND deleted_at IS NULL) n FROM classes WHERE id=?').get(d.classe_id);
   if(!c)throw Object.assign(new Error('Classe inconnue'),{status:400});if(c.n>=c.capacite)throw Object.assign(new Error('Classe complète'),{status:409})}
  const id=db.prepare('INSERT INTO eleves(nom,prenom,date_naissance,classe_id,annee_entree,annee_scolaire,antecedents_medicaux) VALUES(?,?,?,?,?,?,?)').run(d.nom,d.prenom,d.date_naissance,d.classe_id??null,d.annee_entree,d.annee_scolaire,d.antecedents_medicaux??null).lastInsertRowid;
  audit(req.user.id,'eleves',id,'create',null,d);res.status(201).json({id})});
 app.put('/api/eleves/:id',auth,roles('admin','comptable'),(req,res)=>{const d=parse(eleveS.partial(),req.body),old=db.prepare('SELECT * FROM eleves WHERE id=? AND deleted_at IS NULL').get(req.params.id);
  if(!old)return res.status(404).json({erreur:'Introuvable'});if(d.classe_id&&d.classe_id!==old.classe_id){const c=db.prepare('SELECT capacite,(SELECT COUNT(*) FROM eleves WHERE classe_id=classes.id AND deleted_at IS NULL) n FROM classes WHERE id=? AND deleted_at IS NULL').get(d.classe_id);if(!c)throw Object.assign(new Error('Classe inconnue'),{status:400});if(c.n>=c.capacite)throw Object.assign(new Error('Classe complète'),{status:409})}const k=Object.keys(d);
  if(k.length)db.prepare(`UPDATE eleves SET ${k.map(x=>x+'=?').join(',')} WHERE id=?`).run(...k.map(x=>d[x]),old.id);
  audit(req.user.id,'eleves',old.id,'update',old,d);res.json({ok:true})});
 app.delete('/api/eleves/:id',auth,roles('admin'),(req,res)=>{const r=db.prepare("UPDATE eleves SET deleted_at=datetime('now') WHERE id=? AND deleted_at IS NULL").run(req.params.id);
  if(!r.changes)return res.status(404).json({erreur:'Introuvable'});audit(req.user.id,'eleves',+req.params.id,'archive');res.json({ok:true})});
 app.get('/api/eleves/:id/moyennes/:t',auth,(req,res)=>{const{id,role}=req.user,e=+req.params.id;
  const ok=role==='admin'||(role==='enseignant'&&!!db.prepare('SELECT 1 FROM eleves WHERE id=? AND classe_id IN(SELECT id FROM classes WHERE titulaire_id=? UNION SELECT classe_id FROM creneaux WHERE enseignant_id=? UNION SELECT classe_id FROM affectations WHERE enseignant_id=?)').get(e,id,id,id))||(role==='parent'&&db.prepare('SELECT 1 FROM parent_eleve WHERE parent_id=? AND eleve_id=?').get(id,e))||(role==='eleve'&&db.prepare('SELECT 1 FROM eleves WHERE id=? AND user_id=?').get(e,id));
  if(!ok)return res.status(403).json({erreur:'Accès refusé'});res.json(moyennes(db,e,+req.params.t,req.query.annee||(db.prepare('SELECT libelle FROM annees_scolaires WHERE active=1').get()||{}).libelle||'2026-2027'))});
 // Paiements
 app.post('/api/paiements',auth,roles('admin','comptable'),(req,res)=>{const d=parse(z.object({eleveId:z.number().int(),montant:z.number().int().positive(),mode:z.enum(['especes','virement','mobile_money']),annee:z.string()}),req.body);
  res.status(201).json(pay.enregistrer(db,{...d,annee:(db.prepare('SELECT libelle FROM annees_scolaires WHERE active=1').get()||{libelle:d.annee}).libelle,userId:req.user.id}))});
 require('./extra')(app,db,{auth,roles,parse,audit});
 app.use((e,req,res,next)=>{
  if(String(e.code).startsWith('SQLITE_CONSTRAINT'))return res.status(409).json({erreur:"Contrainte d'intégrité violée (doublon ou référence invalide)"});
  if(e.name==='MulterError')return res.status(400).json({erreur:e.code==='LIMIT_FILE_SIZE'?'Fichier trop volumineux (10 Mo maximum)':e.code==='LIMIT_UNEXPECTED_FILE'?'Trop de fichiers (5 maximum)':'Envoi de fichier invalide'});
  if(e.type==='entity.parse.failed')return res.status(400).json({erreur:'Requête invalide'});
  if(!e.status||e.status>=500)console.error('[ERREUR]',req.method,req.originalUrl,e);
  res.status(e.status||500).json({erreur:e.status?e.message:'Erreur interne',details:e.details})});
 return app}
