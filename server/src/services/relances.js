const{solde}=require('./payments');
// Relances d'impayés : manuelles (force) ou automatiques (une par élève tous les N jours, si RELANCES_AUTO=true)
async function lancer(db, {jours=7,force=false}={}) {
 const an=((await db.prepare('SELECT libelle FROM annees_scolaires WHERE active=1').get())||{}).libelle||'2026-2027';let n=0;
 await db.transaction(async () => {for(const e of await db.prepare('SELECT id,nom,prenom FROM eleves WHERE deleted_at IS NULL').all()){const du=await solde(db,e.id,an);if(du<=0)continue;
  if(!force&&(await db.prepare("SELECT 1 FROM journal_envois WHERE type='relance' AND reference=? AND date>datetime('now',?)").get(e.id,`-${jours} days`)))continue;
  for(const{parent_id}of await db.prepare('SELECT parent_id FROM parent_eleve WHERE eleve_id=?').all(e.id)){
   await db.prepare('INSERT INTO messages(expediteur_id,destinataire_id,objet,corps) VALUES(NULL,?,?,?)').run(parent_id,'Rappel de paiement',`Solde restant pour ${e.prenom} ${e.nom} : ${(du/1000).toFixed(3)} TND.`);
   await db.prepare('INSERT INTO notifications(user_id,texte) VALUES(?,?)').run(parent_id,'Rappel de paiement');
   await db.prepare('INSERT INTO journal_envois(type,reference,destinataire_id,canal,statut) VALUES(?,?,?,?,?)').run('relance',e.id,parent_id,'messagerie','envoye');n++}}})();
 return n}
module.exports={lancer};
