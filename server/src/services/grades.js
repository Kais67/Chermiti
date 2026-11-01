// Hypothèse documentée : moyenne matière = moyenne des notes ramenées sur 20 ; générale = Σ(moy×coef)/Σcoef
// Les évaluations sont filtrées par année scolaire (historique pluriannuel). Chaque matière porte son thème et une appréciation en symboles.
const{theme,appreciation}=require('../lib/theme');
function moyennes(db,eleveId,trimestre,annee){
 const rows=db.prepare(`SELECT m.id,m.nom,m.coefficient,m.couleur,m.icone,AVG(n.valeur*20.0/e.bareme) moy FROM notes n JOIN evaluations e ON e.id=n.evaluation_id
  JOIN matieres m ON m.id=e.matiere_id WHERE n.eleve_id=? AND e.trimestre=? AND e.annee_scolaire=? GROUP BY m.id`).all(eleveId,trimestre,annee);
 const el=db.prepare('SELECT classe_id FROM eleves WHERE id=?').get(eleveId);
 const cl=el&&el.classe_id?Object.fromEntries(db.prepare(`SELECT e.matiere_id mid,AVG(n.valeur*20.0/e.bareme) moy FROM notes n JOIN evaluations e ON e.id=n.evaluation_id
  JOIN eleves s ON s.id=n.eleve_id WHERE s.classe_id=? AND e.trimestre=? AND e.annee_scolaire=? GROUP BY e.matiere_id`).all(el.classe_id,trimestre,annee).map(r=>[r.mid,r.moy])):{};
 const sc=rows.reduce((s,r)=>s+r.coefficient,0);
 const generale=sc?rows.reduce((s,r)=>s+r.moy*r.coefficient,0)/sc:null;
 return{annee,matieres:rows.map(r=>({id:r.id,nom:r.nom,coefficient:r.coefficient,moy:+r.moy.toFixed(2),moy_classe:cl[r.id]===undefined?null:+cl[r.id].toFixed(2),...theme(r),appreciation:appreciation(r.moy)})),
  generale:generale===null?null:+generale.toFixed(2),appreciation_generale:appreciation(generale)}}
module.exports={moyennes};
