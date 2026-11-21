const{adminStrict}=require('./middleware/auth');
const{afilter}=require('./lib/async');
// Paiement en ligne (passerelle de DÉMONSTRATION), étoiles de félicitations, vérification publique des reçus
const crypto=require('crypto'),{z}=require('zod');
const pay=require('./services/payments'),{codeRecu}=require('./lib/recu');
module.exports=(app,db,{auth,roles,parse,audit,profEleve,mesEleves,notify,parentsDe,annee,err})=>{
 // ---------- Paiement en ligne : connecteurs (DEMO, Flouci, Konnect) ----------
 // DEMO et mode « sandbox » n'encaissent AUCUN argent réel : leurs paiements sont enregistrés avec simule=1 (affichés « TEST » partout, reçu filigrané).
 // Les clés des fournisseurs réels se configurent par école (admin) : voir docs/paiements.md. La DEMO est refusée en production réelle.
 const PF=require('./services/paiement');
 const lie=async (p, e) => !!(await db.prepare('SELECT 1 FROM parent_eleve WHERE parent_id=? AND eleve_id=?').get(p,e));
 const baseUrl=q=>process.env.PUBLIC_URL||`${q.protocol}://${q.get('host')}`,ec=()=>db.ecole?`&ecole=${db.ecole}`:'';
 const resume=l=>l.filter(x=>x.actif).map(x=>({id:x.id,label:x.label,mode:x.mode,simule:x.simule}));
 app.get('/api/paiement-en-ligne/config',auth,async (q,r)=>{const l=await PF.etat(db),d=l.find(x=>x.id!=='demo'&&x.actif)||l.find(x=>x.id==='demo'&&x.actif);
  r.json({actif:!!d,mode:d?(d.simule?'simulation':'reel'):'desactive',defaut:d?d.id:null,simule:d?d.simule:null,fournisseurs:resume(l),
   avertissement:d&&d.simule?"MODE TEST : aucun argent réel n'est débité. Les paiements effectués ici sont des simulations sans valeur comptable.":null})});
 app.get('/api/admin/paiement/config',auth,roles('admin'),adminStrict,async (q,r)=>r.json({prodReelle:PF.prodReelle(),fournisseurs:PF.publique(await PF.etat(db)),webhook:{flouci:`${baseUrl(q)}/api/webhooks/flouci`,konnect:`${baseUrl(q)}/api/webhooks/konnect`}}));
 app.put('/api/admin/paiement/config/:id',auth,roles('admin'),adminStrict,async (q,r)=>{
  const d=parse(z.object({actif:z.boolean(),mode:z.enum(['sandbox','live']).optional(),secrets:z.record(z.string(),z.string()).optional()}),q.body);
  if(d.mode==='live'&&d.actif&&!/^https:/i.test(baseUrl(q)))throw err(400,'Le mode réel exige une adresse publique en HTTPS (PUBLIC_URL)');
  await PF.sauver(db,q.params.id,d);await audit(q.user.id,'config_paiement',null,'update',null,{fournisseur:q.params.id,actif:d.actif,mode:d.mode});r.json({ok:true})});
 app.post('/api/paiements-en-ligne',auth,roles('parent'),async (q, r) => {
  const d=parse(z.object({eleve_id:z.number().int(),montant_millimes:z.number().int().min(1000,'Montant minimum : 1 TND'),fournisseur:z.enum(['demo','flouci','konnect']).optional()}),q.body);
  const l=await PF.etat(db),p=d.fournisseur?l.find(x=>x.id===d.fournisseur&&x.actif):(l.find(x=>x.id!=='demo'&&x.actif)||l.find(x=>x.id==='demo'&&x.actif));
  if(!p)throw err(503,"Le paiement en ligne n'est pas activé");
  if(!(await lie(q.user.id,d.eleve_id)))throw err(403,'Accès refusé');const du=await pay.solde(db,d.eleve_id,await annee());
  if(du<=0)throw err(409,'Aucun solde à régler pour cet enfant');if(d.montant_millimes>du)throw err(409,`Le montant dépasse le solde restant (${(du/1000).toFixed(3)} TND)`);
  const token=crypto.randomBytes(16).toString('hex');
  const id=(await db.prepare('INSERT INTO paiements_en_ligne(token,eleve_id,parent_id,montant_millimes,fournisseur,simule) VALUES(?,?,?,?,?,?)').run(token,d.eleve_id,q.user.id,d.montant_millimes,p.id,p.simule?1:0)).lastInsertRowid;
  let url='/paiement/'+token;
  if(p.id!=='demo'){
   try{const c=PF.F.tous[p.id],b=baseUrl(q),x=await c.creer(p._secrets,p.mode,{montant:d.montant_millimes,tracking:token.slice(0,16),description:'Frais de scolarité',
     successUrl:`${b}/paiement/${token}?retour=1${ec()}`,failUrl:`${b}/paiement/${token}?retour=0${ec()}`,webhookUrl:`${b}/api/webhooks/${p.id}?token=${token}${ec()}`});
    await db.prepare('UPDATE paiements_en_ligne SET reference_externe=? WHERE id=?').run(x.refExterne,id);url=x.url}
   catch(e){await db.prepare("UPDATE paiements_en_ligne SET statut='echoue' WHERE id=?").run(id);throw e}}
  r.status(201).json({token,url,fournisseur:p.id,simule:p.simule,externe:p.id!=='demo'})});
 const session=async q => {const s=await db.prepare('SELECT s.*,e.prenom,e.nom FROM paiements_en_ligne s JOIN eleves e ON e.id=s.eleve_id WHERE s.token=? AND s.parent_id=?').get(q.params.token,q.user.id);if(!s)throw err(404,'Session de paiement introuvable');return s};
 const expiree=s=>Date.now()-new Date(s.created_at.replace(' ','T')+'Z').getTime()>30*60*1000;
 app.get('/api/paiements-en-ligne/:token',auth,roles('parent'),async (q, r) => {const s=await session(q);r.json({token:s.token,statut:s.statut==='en_attente'&&expiree(s)?'expire':s.statut,montant_millimes:s.montant_millimes,enfant:`${s.prenom} ${s.nom}`,fournisseur:s.fournisseur,paiement_id:s.paiement_id,mode:s.simule?'simulation':'reel',simule:!!s.simule})});
 // Finalisation unique et idempotente : la session passe à « payé » une seule fois, puis le paiement est enregistré
 const finaliser=async (s,userId,ref) => {
  if(!(await db.prepare("UPDATE paiements_en_ligne SET statut='paye' WHERE id=? AND statut='en_attente'").run(s.id)).changes)return{deja:true};
  try{const res=await pay.enregistrer(db,{eleveId:s.eleve_id,montant:s.montant_millimes,mode:'carte_en_ligne',annee:await annee(),userId:null,canal:'en_ligne',simule:s.simule,reference:ref||('SIM-'+s.token.slice(0,8).toUpperCase())});
   await db.prepare('UPDATE paiements_en_ligne SET paiement_id=? WHERE id=?').run(res.id,s.id);await audit(userId,'paiements',res.id,s.simule?'paiement_en_ligne_test':'paiement_en_ligne',null,{montant:s.montant_millimes,fournisseur:s.fournisseur});return{statut:'paye',paiement_id:res.id,solde:res.solde,simule:!!s.simule}}
  catch(e){await db.prepare("UPDATE paiements_en_ligne SET statut='echoue' WHERE id=?").run(s.id);throw e}};
 // Confirmation DEMO (page de démonstration) : refusée pour tout autre fournisseur
 app.post('/api/paiements-en-ligne/:token/confirmer',auth,roles('parent'),async (q, r) => {
  const d=parse(z.object({resultat:z.enum(['succes','echec','annule'])}),q.body),s=await session(q);
  if(s.fournisseur!=='demo'||!PF.demoAutorisee())throw err(503,"Le paiement en ligne de démonstration n'est pas activé");
  if(s.statut!=='en_attente')throw err(409,'Cette session a déjà été traitée');
  if(expiree(s)){await db.prepare("UPDATE paiements_en_ligne SET statut='expire' WHERE id=? AND statut='en_attente'").run(s.id);throw err(410,'Cette session de paiement a expiré. Recommencez.')}
  if(d.resultat!=='succes'){const st=d.resultat==='echec'?'echoue':'annule';await db.prepare('UPDATE paiements_en_ligne SET statut=? WHERE id=?').run(st,s.id);return r.json({statut:st})}
  const o=await finaliser(s,q.user.id);if(o.deja)throw err(409,'Cette session a déjà été traitée');r.json(o)});
 // Vérification auprès du fournisseur (jamais fondée sur le navigateur) : retour de redirection ou webhook
 const verifierExterne=async (s,userId) => {
  if(s.statut!=='en_attente')return{statut:s.statut,paiement_id:s.paiement_id};
  const l=await PF.etat(db),p=l.find(x=>x.id===s.fournisseur);if(!p||!s.reference_externe)throw err(409,'Session non vérifiable');
  const v=await PF.F.tous[p.id].verifier(p._secrets,p.mode,s.reference_externe);
  if(v.statut==='echec'){await db.prepare("UPDATE paiements_en_ligne SET statut='echoue' WHERE id=? AND statut='en_attente'").run(s.id);return{statut:'echoue'}}
  if(v.statut!=='paye')return{statut:'en_attente'};
  if(v.montant!=null&&Number(v.montant)!==s.montant_millimes){await db.prepare("UPDATE paiements_en_ligne SET statut='echoue' WHERE id=? AND statut='en_attente'").run(s.id);await audit(userId,'paiements_en_ligne',s.id,'montant_incoherent',null,{attendu:s.montant_millimes,recu:v.montant});throw err(409,'Montant confirmé par le fournisseur différent du montant demandé : paiement refusé, contactez le secrétariat')}
  const o=await finaliser(s,userId,s.fournisseur.toUpperCase()+'-'+s.reference_externe);return o.deja?{statut:'paye'}:o};
 app.post('/api/paiements-en-ligne/:token/verifier',auth,roles('parent'),async (q,r)=>r.json(await verifierExterne(await session(q),q.user.id)));
 app.all('/api/webhooks/:fournisseur',async (q,r)=>{const s=await db.prepare('SELECT * FROM paiements_en_ligne WHERE token=? AND fournisseur=?').get(String(q.query.token||''),q.params.fournisseur);
  if(!s)return r.status(404).json({erreur:'Session inconnue'});await verifierExterne(s,null);r.json({ok:true})});
 // ---------- Espèces : demande du parent, validation par le secrétariat (admin / comptable) ----------
 const secretariat=roles('admin','comptable'),DEL_ESP=15*864e5;
 const dem=async id=>{const x=await db.prepare('SELECT d.*,e.prenom,e.nom,u.nom parent FROM demandes_especes d JOIN eleves e ON e.id=d.eleve_id JOIN users u ON u.id=d.parent_id WHERE d.id=?').get(id);if(!x)throw err(404,'Demande introuvable');return x};
 const periodee=x=>x.statut==='en_attente'&&Date.now()-new Date(x.created_at.replace(' ','T')+'Z').getTime()>DEL_ESP;
 const vue=x=>({...x,statut:periodee(x)?'expiree':x.statut});
 app.post('/api/paiements-especes',auth,roles('parent'),async (q,r)=>{
  const d=parse(z.object({eleve_id:z.number().int(),montant_millimes:z.number().int().min(1000,'Montant minimum : 1 TND')}),q.body);
  if(!(await lie(q.user.id,d.eleve_id)))throw err(403,'Accès refusé');const du=await pay.solde(db,d.eleve_id,await annee());
  if(du<=0)throw err(409,'Aucun solde à régler pour cet enfant');if(d.montant_millimes>du)throw err(409,`Le montant dépasse le solde restant (${(du/1000).toFixed(3)} TND)`);
  if((await db.prepare("SELECT COUNT(*) n FROM demandes_especes WHERE eleve_id=? AND statut='en_attente'").get(d.eleve_id)).n>=3)throw err(409,"Trop de demandes en attente pour cet enfant : présentez-vous au secrétariat");
  const ref='ESP-'+crypto.randomBytes(4).toString('hex').toUpperCase();
  const id=(await db.prepare('INSERT INTO demandes_especes(reference,eleve_id,parent_id,montant_millimes) VALUES(?,?,?,?)').run(ref,d.eleve_id,q.user.id,d.montant_millimes)).lastInsertRowid;
  for(const u of await db.prepare("SELECT id FROM users WHERE role IN('admin','comptable') AND deleted_at IS NULL").all())await notify(u.id,`Nouvelle demande de paiement en espèces ${ref} (${(d.montant_millimes/1000).toFixed(3)} TND) à valider`);
  r.status(201).json({id,reference:ref,message:"Présentez-vous au secrétariat avec cette référence. Le paiement ne sera pris en compte qu'après validation par le secrétariat."})});
 app.get('/api/paiements-especes',auth,roles('parent','admin','comptable'),async (q,r)=>{
  const rows=q.user.role==='parent'?await db.prepare('SELECT d.*,e.prenom,e.nom,u.nom parent FROM demandes_especes d JOIN eleves e ON e.id=d.eleve_id JOIN users u ON u.id=d.parent_id WHERE d.parent_id=? ORDER BY d.id DESC').all(q.user.id)
   :await db.prepare('SELECT d.*,e.prenom,e.nom,u.nom parent FROM demandes_especes d JOIN eleves e ON e.id=d.eleve_id JOIN users u ON u.id=d.parent_id ORDER BY d.id DESC').all();
  const st=q.query.statut;r.json(rows.map(vue).filter(x=>!st||x.statut===st))});
 app.post('/api/paiements-especes/:id/valider',auth,secretariat,async (q,r)=>{
  const d=parse(z.object({montant_recu_millimes:z.number().int().min(1).optional()}),q.body||{}),x=await dem(q.params.id);
  if(periodee(x))throw err(410,'Demande expirée (plus de 15 jours) : demandez au parent de refaire la demande');
  const m=d.montant_recu_millimes||x.montant_millimes;let res;
  await db.transaction(async()=>{
   if(!(await db.prepare("UPDATE demandes_especes SET statut='validee',traite_par=?,traite_le=datetime('now') WHERE id=? AND statut='en_attente'").run(q.user.id,x.id)).changes)throw err(409,'Cette demande a déjà été traitée');
   res=await pay.enregistrer(db,{eleveId:x.eleve_id,montant:m,mode:'especes',annee:await annee(),userId:q.user.id,canal:'guichet',reference:x.reference});
   await db.prepare('UPDATE demandes_especes SET paiement_id=? WHERE id=?').run(res.id,x.id)})();
  await audit(q.user.id,'demandes_especes',x.id,'valider',null,{montant:m,paiement_id:res.id});r.json({statut:'validee',paiement_id:res.id,solde:res.solde})});
 const cloturer=(statut)=>async (q,r)=>{const d=parse(z.object({motif:z.string().max(300).optional()}),q.body||{}),x=await dem(q.params.id);
  const parentOnly=statut==='annulee';if(parentOnly&&(q.user.role!=='parent'||x.parent_id!==q.user.id))throw err(403,'Accès refusé');
  if(!(await db.prepare("UPDATE demandes_especes SET statut=?,traite_par=?,traite_le=datetime('now'),motif=? WHERE id=? AND statut='en_attente'").run(statut,q.user.id,d.motif||null,x.id)).changes)throw err(409,'Cette demande a déjà été traitée');
  if(!parentOnly)await notify(x.parent_id,`Votre demande de paiement en espèces ${x.reference} a été refusée${d.motif?' : '+d.motif:''}`);
  await audit(q.user.id,'demandes_especes',x.id,statut,null,{motif:d.motif});r.json({statut})};
 app.post('/api/paiements-especes/:id/refuser',auth,secretariat,cloturer('refusee'));
 app.post('/api/paiements-especes/:id/annuler',auth,roles('parent'),cloturer('annulee'));
 // ---------- Étoiles de félicitations ----------
 const ICO=['etoile','coeur','trophee','pouce','fusee','livre'];
 app.get('/api/felicitations',auth,async (q, r) => {if(q.user.role==='comptable')throw err(403,'Accès refusé');
  let rows=await db.prepare('SELECT f.*,e.prenom,e.nom,u.nom enseignant FROM felicitations f JOIN eleves e ON e.id=f.eleve_id LEFT JOIN users u ON u.id=f.enseignant_id ORDER BY f.id DESC').all();const m=await mesEleves(q.user);
  if(q.user.role==='enseignant')rows=await afilter(rows, async x => await profEleve(q.user,x.eleve_id));else if(m)rows=rows.filter(x=>m.includes(x.eleve_id));r.json(rows)});
 app.post('/api/felicitations',auth,roles('admin','enseignant'),async (q, r) => {const d=parse(z.object({eleve_id:z.number().int(),motif:z.string().min(3).max(120),icone:z.enum(ICO).optional()}),q.body);
  const e=await db.prepare('SELECT id,user_id FROM eleves WHERE id=? AND deleted_at IS NULL').get(d.eleve_id);if(!e)throw err(404,'Élève introuvable');
  if(q.user.role==='enseignant'&&!(await profEleve(q.user,e.id)))throw err(403,"Cet élève n'est pas dans l'une de vos classes");
  const id=(await db.prepare('INSERT INTO felicitations(eleve_id,enseignant_id,motif,icone,annee_scolaire) VALUES(?,?,?,?,?)').run(e.id,q.user.id,d.motif,d.icone||'etoile',await annee())).lastInsertRowid;
  for(const p of await parentsDe(e.id))await notify(p,'⭐ Félicitations : '+d.motif);if(e.user_id)await notify(e.user_id,'⭐ Félicitations : '+d.motif);await audit(q.user.id,'felicitations',id,'create',null,d);r.status(201).json({id})});
 app.delete('/api/felicitations/:id',auth,roles('admin','enseignant'),async (q, r) => {const f=await db.prepare('SELECT * FROM felicitations WHERE id=?').get(q.params.id);if(!f)throw err(404,'Introuvable');
  if(q.user.role==='enseignant'&&f.enseignant_id!==q.user.id)throw err(403,'Accès refusé');await db.prepare('DELETE FROM felicitations WHERE id=?').run(f.id);await audit(q.user.id,'felicitations',f.id,'delete',f);r.json({ok:true})});
 // ---------- Vérification publique d'un reçu (QR code) : ne révèle ni nom ni classe ----------
 const essais=new Map();
 app.get('/api/public/verifier-recu/:id/:code',async (q, r) => {const now=Date.now(),a=(essais.get(q.ip)||[]).filter(t=>now-t<36e5);if(a.length>=60)return r.status(429).json({erreur:'Trop de vérifications, réessayez plus tard'});a.push(now);essais.set(q.ip,a);
  const p=await db.prepare('SELECT * FROM paiements WHERE id=? AND deleted_at IS NULL').get(q.params.id);
  if(!p||codeRecu(p)!==String(q.params.code).trim().toUpperCase())return r.json({valide:false});r.json({valide:true,simule:!!p.simule,numero:p.id,montant_millimes:p.montant_millimes,date:p.date,canal:p.canal,ecole:db.ecoleNom||'École'})});
};
