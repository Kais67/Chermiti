const mailer=require('./mailer');
async function solde(db, eleveId, annee) {
 const f=(await db.prepare('SELECT COALESCE(SUM(montant_millimes),0) t FROM frais WHERE eleve_id=? AND annee_scolaire=?').get(eleveId,annee)).t;
 const p=(await db.prepare('SELECT COALESCE(SUM(montant_millimes),0) t FROM paiements WHERE eleve_id=? AND annee_scolaire=? AND deleted_at IS NULL').get(eleveId,annee)).t;
 return f-p}
// Une seule transaction : paiement + solde + message au parent + notification + journal d'envoi + audit
const LIB={especes:"espèces",virement:"virement",mobile_money:"mobile money",carte_en_ligne:"paiement en ligne"};
async function enregistrer(db, {eleveId,montant,mode,annee,userId,canal="guichet",reference=null,simule=0}) {
 const out=await db.transaction(async () => {
  const du=await solde(db,eleveId,annee);if(montant>du)throw Object.assign(new Error(du<=0?'Aucun solde à régler pour cet élève':`Le montant dépasse le solde restant (${(du/1000).toFixed(3)} TND)`),{status:409});
  const reste=du-montant,date=new Date().toISOString();
  const id=(await db.prepare('INSERT INTO paiements(eleve_id,montant_millimes,mode,date,solde_apres_millimes,annee_scolaire,canal,reference,simule) VALUES(?,?,?,?,?,?,?,?,?)').run(eleveId,montant,mode,date,reste,annee,canal,reference,simule?1:0)).lastInsertRowid;
  const txt=`${simule?'[PAIEMENT DE TEST — AUCUN ARGENT RÉEL] ':''}Paiement de ${(montant/1000).toFixed(3)} TND reçu le ${date.slice(0,10)} (${LIB[mode]||mode}). Solde restant : ${(reste/1000).toFixed(3)} TND. Reçu à télécharger : ${process.env.PUBLIC_URL||''}/paiements?recu=${id}`;
  const parents=[];
  for(const{parent_id}of await db.prepare('SELECT parent_id FROM parent_eleve WHERE eleve_id=?').all(eleveId)){
   await db.prepare('INSERT INTO messages(expediteur_id,destinataire_id,objet,corps) VALUES(?,?,?,?)').run(userId,parent_id,'Confirmation de paiement',txt);
   await db.prepare('INSERT INTO notifications(user_id,texte) VALUES(?,?)').run(parent_id,'Nouveau paiement enregistré');
   await db.prepare('INSERT INTO journal_envois(type,reference,destinataire_id,canal,statut) VALUES(?,?,?,?,?)').run('paiement',id,parent_id,'messagerie','envoye');parents.push(parent_id)}
  await db.prepare('INSERT INTO audit_log(user_id,entite,entite_id,action,nouvelles) VALUES(?,?,?,?,?)').run(userId,'paiements',id,'create',JSON.stringify({montant,mode,simule:simule?1:0}));
  return{id,solde:reste,parents,txt}})();
 if(mailer.actif())setImmediate(async()=>{for(const pid of out.parents){const u=await db.prepare('SELECT email FROM users WHERE id=?').get(pid);const r=await mailer.envoyer(u.email,'Confirmation de paiement',out.txt);
  try{await db.prepare('INSERT INTO journal_envois(type,reference,destinataire_id,canal,statut,detail) VALUES(?,?,?,?,?,?)').run('paiement',out.id,pid,'email',r.statut,r.detail||null)}catch{}}});
 return{id:out.id,solde:out.solde}}
module.exports={solde,enregistrer};
