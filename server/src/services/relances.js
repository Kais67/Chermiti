const{solde}=require('./payments');
// Relances d'impayés : manuelles (force) ou automatiques (une par élève tous les N jours, si RELANCES_AUTO=true)
function lancer(db,{jours=7,force=false}={}){
 const an=(db.prepare('SELECT libelle FROM annees_scolaires WHERE active=1').get()||{}).libelle||'2026-2027';let n=0;
 db.transaction(()=>{for(const e of db.prepare('SELECT id,nom,prenom FROM eleves WHERE deleted_at IS NULL').all()){const du=solde(db,e.id,an);if(du<=0)continue;
  if(!force&&db.prepare("SELECT 1 FROM journal_envois WHERE type='relance' AND reference=? AND date>datetime('now',?)").get(e.id,`-${jours} days`))continue;
  for(const{parent_id}of db.prepare('SELECT parent_id FROM parent_eleve WHERE eleve_id=?').all(e.id)){
   db.prepare('INSERT INTO messages(expediteur_id,destinataire_id,objet,corps) VALUES(NULL,?,?,?)').run(parent_id,'Rappel de paiement',`Solde restant pour ${e.prenom} ${e.nom} : ${(du/1000).toFixed(3)} TND.`);
   db.prepare('INSERT INTO notifications(user_id,texte) VALUES(?,?)').run(parent_id,'Rappel de paiement');
   db.prepare('INSERT INTO journal_envois(type,reference,destinataire_id,canal,statut) VALUES(?,?,?,?,?)').run('relance',e.id,parent_id,'messagerie','envoye');n++}}})();
 return n}
module.exports={lancer};
