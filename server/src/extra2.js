// Paiement en ligne (passerelle de DÉMONSTRATION), étoiles de félicitations, vérification publique des reçus
const crypto=require('crypto'),{z}=require('zod');
const pay=require('./services/payments'),{codeRecu}=require('./lib/recu');
module.exports=(app,db,{auth,roles,parse,audit,profEleve,mesEleves,notify,parentsDe,annee,err})=>{
 // ---------- Paiement en ligne ----------
 // PAIEMENT_EN_LIGNE=simulation (défaut) : aucune carte n'est demandée et aucun argent réel n'est débité.
 // Un vrai prestataire (Konnect, Paymee, Flouci, ClicToPay…) nécessite un compte marchand : à brancher à la place de la confirmation simulée.
 // Par défaut : actif en développement et en mode démonstration (ALLOW_DEMO_SEED), DÉSACTIVÉ en production réelle (sinon un parent pourrait « payer » sans payer).
 const mode=()=>process.env.PAIEMENT_EN_LIGNE||((process.env.NODE_ENV==='production'&&process.env.ALLOW_DEMO_SEED!=='true')?'desactive':'simulation'),actif=()=>mode()==='simulation';
 const lie=(p,e)=>!!db.prepare('SELECT 1 FROM parent_eleve WHERE parent_id=? AND eleve_id=?').get(p,e);
 app.get('/api/paiement-en-ligne/config',auth,(q,r)=>r.json({actif:actif(),mode:actif()?'simulation':'desactive'}));
 app.post('/api/paiements-en-ligne',auth,roles('parent'),(q,r)=>{if(!actif())throw err(503,"Le paiement en ligne n'est pas activé");
  const d=parse(z.object({eleve_id:z.number().int(),montant_millimes:z.number().int().min(1000,'Montant minimum : 1 TND')}),q.body);
  if(!lie(q.user.id,d.eleve_id))throw err(403,'Accès refusé');const du=pay.solde(db,d.eleve_id,annee());
  if(du<=0)throw err(409,'Aucun solde à régler pour cet enfant');if(d.montant_millimes>du)throw err(409,`Le montant dépasse le solde restant (${(du/1000).toFixed(3)} TND)`);
  const token=crypto.randomBytes(16).toString('hex');db.prepare('INSERT INTO paiements_en_ligne(token,eleve_id,parent_id,montant_millimes) VALUES(?,?,?,?)').run(token,d.eleve_id,q.user.id,d.montant_millimes);r.status(201).json({token,url:'/paiement/'+token})});
 const session=q=>{const s=db.prepare('SELECT s.*,e.prenom,e.nom FROM paiements_en_ligne s JOIN eleves e ON e.id=s.eleve_id WHERE s.token=? AND s.parent_id=?').get(q.params.token,q.user.id);if(!s)throw err(404,'Session de paiement introuvable');return s};
 const expiree=s=>Date.now()-new Date(s.created_at.replace(' ','T')+'Z').getTime()>30*60*1000;
 app.get('/api/paiements-en-ligne/:token',auth,roles('parent'),(q,r)=>{const s=session(q);r.json({token:s.token,statut:s.statut==='en_attente'&&expiree(s)?'expire':s.statut,montant_millimes:s.montant_millimes,enfant:`${s.prenom} ${s.nom}`,fournisseur:s.fournisseur,paiement_id:s.paiement_id,mode:'simulation'})});
 app.post('/api/paiements-en-ligne/:token/confirmer',auth,roles('parent'),(q,r)=>{if(!actif())throw err(503,"Le paiement en ligne n'est pas activé");
  const d=parse(z.object({resultat:z.enum(['succes','echec','annule'])}),q.body),s=session(q);if(s.statut!=='en_attente')throw err(409,'Cette session a déjà été traitée');
  if(expiree(s)){db.prepare("UPDATE paiements_en_ligne SET statut='expire' WHERE id=? AND statut='en_attente'").run(s.id);throw err(410,'Cette session de paiement a expiré. Recommencez.')}
  if(d.resultat!=='succes'){const st=d.resultat==='echec'?'echoue':'annule';db.prepare('UPDATE paiements_en_ligne SET statut=? WHERE id=?').run(st,s.id);return r.json({statut:st})}
  if(!db.prepare("UPDATE paiements_en_ligne SET statut='paye' WHERE id=? AND statut='en_attente'").run(s.id).changes)throw err(409,'Cette session a déjà été traitée');
  try{const res=pay.enregistrer(db,{eleveId:s.eleve_id,montant:s.montant_millimes,mode:'carte_en_ligne',annee:annee(),userId:null,canal:'en_ligne',reference:'SIM-'+s.token.slice(0,8).toUpperCase()});
   db.prepare('UPDATE paiements_en_ligne SET paiement_id=? WHERE id=?').run(res.id,s.id);audit(q.user.id,'paiements',res.id,'paiement_en_ligne_simule',null,{montant:s.montant_millimes});r.json({statut:'paye',paiement_id:res.id,solde:res.solde})}
  catch(e){db.prepare("UPDATE paiements_en_ligne SET statut='echoue' WHERE id=?").run(s.id);throw e}});
 // ---------- Étoiles de félicitations ----------
 const ICO=['etoile','coeur','trophee','pouce','fusee','livre'];
 app.get('/api/felicitations',auth,(q,r)=>{if(q.user.role==='comptable')throw err(403,'Accès refusé');
  let rows=db.prepare('SELECT f.*,e.prenom,e.nom,u.nom enseignant FROM felicitations f JOIN eleves e ON e.id=f.eleve_id LEFT JOIN users u ON u.id=f.enseignant_id ORDER BY f.id DESC').all();const m=mesEleves(q.user);
  if(q.user.role==='enseignant')rows=rows.filter(x=>profEleve(q.user,x.eleve_id));else if(m)rows=rows.filter(x=>m.includes(x.eleve_id));r.json(rows)});
 app.post('/api/felicitations',auth,roles('admin','enseignant'),(q,r)=>{const d=parse(z.object({eleve_id:z.number().int(),motif:z.string().min(3).max(120),icone:z.enum(ICO).optional()}),q.body);
  const e=db.prepare('SELECT id,user_id FROM eleves WHERE id=? AND deleted_at IS NULL').get(d.eleve_id);if(!e)throw err(404,'Élève introuvable');
  if(q.user.role==='enseignant'&&!profEleve(q.user,e.id))throw err(403,"Cet élève n'est pas dans l'une de vos classes");
  const id=db.prepare('INSERT INTO felicitations(eleve_id,enseignant_id,motif,icone,annee_scolaire) VALUES(?,?,?,?,?)').run(e.id,q.user.id,d.motif,d.icone||'etoile',annee()).lastInsertRowid;
  for(const p of parentsDe(e.id))notify(p,'⭐ Félicitations : '+d.motif);if(e.user_id)notify(e.user_id,'⭐ Félicitations : '+d.motif);audit(q.user.id,'felicitations',id,'create',null,d);r.status(201).json({id})});
 app.delete('/api/felicitations/:id',auth,roles('admin','enseignant'),(q,r)=>{const f=db.prepare('SELECT * FROM felicitations WHERE id=?').get(q.params.id);if(!f)throw err(404,'Introuvable');
  if(q.user.role==='enseignant'&&f.enseignant_id!==q.user.id)throw err(403,'Accès refusé');db.prepare('DELETE FROM felicitations WHERE id=?').run(f.id);audit(q.user.id,'felicitations',f.id,'delete',f);r.json({ok:true})});
 // ---------- Vérification publique d'un reçu (QR code) : ne révèle ni nom ni classe ----------
 const essais=new Map();
 app.get('/api/public/verifier-recu/:id/:code',(q,r)=>{const now=Date.now(),a=(essais.get(q.ip)||[]).filter(t=>now-t<36e5);if(a.length>=60)return r.status(429).json({erreur:'Trop de vérifications, réessayez plus tard'});a.push(now);essais.set(q.ip,a);
  const p=db.prepare('SELECT * FROM paiements WHERE id=? AND deleted_at IS NULL').get(q.params.id);
  if(!p||codeRecu(p)!==String(q.params.code).trim().toUpperCase())return r.json({valide:false});r.json({valide:true,numero:p.id,montant_millimes:p.montant_millimes,date:p.date,canal:p.canal,ecole:'École Abou El Kacem Chebbi'})});
};
