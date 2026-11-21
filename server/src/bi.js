// Module Business Intelligence & Aide à la décision (directeur / administration). Lecture seule, calculs sur la base de l'école courante.
// GET /api/bi/:tableau?annee=AAAA-AAAA   — tableaux : general, financier, pedagogique, absences, enseignants, communications, salles, risques, strategique
const stats={
 moy:a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null,
 r:(a,b)=>{const n=a.length;if(n<3)return null;const ma=stats.moy(a),mb=stats.moy(b);let sab=0,saa=0,sbb=0;for(let i=0;i<n;i++){sab+=(a[i]-ma)*(b[i]-mb);saa+=(a[i]-ma)**2;sbb+=(b[i]-mb)**2}return saa&&sbb?sab/Math.sqrt(saa*sbb):null},
 reg:pts=>{const n=pts.length;if(n<2)return null;const mx=stats.moy(pts.map(p=>p[0])),my=stats.moy(pts.map(p=>p[1]));let sxy=0,sxx=0;for(const[x,y]of pts){sxy+=(x-mx)*(y-my);sxx+=(x-mx)**2}const b=sxx?sxy/sxx:0;return{a:my-b*mx,b}}};
const r1=x=>x===null||x===undefined?null:Math.round(x*10)/10,r2=x=>x===null||x===undefined?null:Math.round(x*100)/100,pct=(a,b)=>b?Math.round(a/b*1000)/10:null;
const hm=t=>{const[h,m]=t.split(':').map(Number);return h*60+m};
const joursOuvres=(d0,d1)=>{let n=0;for(let d=new Date(d0);d<=d1;d.setUTCDate(d.getUTCDate()+1)){const w=d.getUTCDay();if(w&&w<6)n++}return n};
module.exports=(app,db,{auth,roles})=>{
 const all=(sql,...p)=>db.prepare(sql).all(...p),one=(sql,...p)=>db.prepare(sql).get(...p);
 const anneeActive=async()=>((await one('SELECT libelle FROM annees_scolaires WHERE active=1'))||{}).libelle;
 const prec=an=>{const[a,b]=an.split('-').map(Number);return`${a-1}-${b-1}`};
 const debutAn=an=>Date.UTC(+an.split('-')[0],8,15);
 // ---------- Données de base partagées ----------
 async function eleves(){return all('SELECT e.id,e.nom,e.prenom,e.classe_id,e.annee_entree,c.niveau,c.section FROM eleves e LEFT JOIN classes c ON c.id=e.classe_id WHERE e.deleted_at IS NULL')}
 // Moyenne générale pondérée par élève, année et trimestre
 async function resultats(){
  const rows=await all(`SELECT n.eleve_id,e.annee_scolaire an,e.trimestre t,e.matiere_id,m.nom matiere,m.coefficient c,AVG(n.valeur*20.0/e.bareme) moy FROM notes n JOIN evaluations e ON e.id=n.evaluation_id JOIN matieres m ON m.id=e.matiere_id GROUP BY n.eleve_id,e.annee_scolaire,e.trimestre,e.matiere_id,m.nom,m.coefficient`);
  const g={};for(const r of rows){const k=`${r.eleve_id}|${r.an}|${r.t}`;(g[k]=g[k]||{eleve:r.eleve_id,an:r.an,t:r.t,s:0,c:0,mat:{}});g[k].s+=r.moy*r.c;g[k].c+=r.c;g[k].mat[r.matiere]=r.moy}
  return Object.values(g).map(x=>({...x,gen:x.c?x.s/x.c:null}))}
 const dernierT=(res,an)=>{const t=res.filter(r=>r.an===an).map(r=>r.t);return t.length?Math.max(...t):null};
 const soldes=async an=>{const f=Object.fromEntries((await all('SELECT eleve_id,SUM(montant_millimes) s FROM frais WHERE annee_scolaire=? GROUP BY eleve_id',an)).map(r=>[r.eleve_id,r.s]));
  const p=Object.fromEntries((await all('SELECT eleve_id,SUM(montant_millimes) s FROM paiements WHERE annee_scolaire=? AND deleted_at IS NULL GROUP BY eleve_id',an)).map(r=>[r.eleve_id,r.s]));
  const dp=Object.fromEntries((await all('SELECT eleve_id,MAX(date) d FROM paiements WHERE annee_scolaire=? AND deleted_at IS NULL GROUP BY eleve_id',an)).map(r=>[r.eleve_id,r.d]));
  return{f,p,dp,solde:id=>(f[id]||0)-(p[id]||0)}};
 // ---------- 1. Général ----------
 async function general(an){
  const cls=await all('SELECT c.id,c.niveau,c.section,c.capacite,(SELECT COUNT(*) FROM eleves e WHERE e.classe_id=c.id AND e.deleted_at IS NULL) eff FROM classes c WHERE c.deleted_at IS NULL AND c.annee_scolaire=? ORDER BY c.niveau,c.section',an);
  const ens=(await one("SELECT COUNT(*) n FROM users WHERE role='enseignant' AND deleted_at IS NULL")).n,aff=cls.reduce((s,c)=>s+c.eff,0),cap=cls.reduce((s,c)=>s+c.capacite,0),tot=(await one('SELECT COUNT(*) n FROM eleves WHERE deleted_at IS NULL')).n;
  const niv={};for(const c of cls){(niv[c.niveau]=niv[c.niveau]||{niveau:c.niveau,effectif:0,capacite:0,classes:0});niv[c.niveau].effectif+=c.eff;niv[c.niveau].capacite+=c.capacite;niv[c.niveau].classes++}
  const par_classe=cls.map(c=>({classe:`${c.niveau} ${c.section}`,effectif:c.eff,capacite:c.capacite,taux:pct(c.eff,c.capacite),etat:c.eff>c.capacite?'surchargée':c.eff/c.capacite>=0.9?'presque pleine':c.eff/c.capacite<0.5?'sous-remplie':'normale'}));
  const entrees=await all("SELECT annee_entree a,COUNT(*) n FROM eleves WHERE deleted_at IS NULL GROUP BY annee_entree ORDER BY annee_entree");
  const factures=await all('SELECT annee_scolaire a,COUNT(DISTINCT eleve_id) n FROM frais GROUP BY annee_scolaire ORDER BY annee_scolaire');
  return{annee:an,kpis:{eleves:tot,eleves_affectes:aff,eleves_sans_classe:tot-aff,enseignants:ens,classes:cls.length,capacite:cap,taux_occupation:pct(aff,cap),ratio_eleves_enseignant:ens?r1(tot/ens):null},
   par_niveau:Object.values(niv).map(n=>({...n,taux:pct(n.effectif,n.capacite)})),par_classe,
   alertes:par_classe.filter(c=>c.etat==='surchargée'||c.etat==='sous-remplie').map(c=>({niveau:c.etat==='surchargée'?'danger':'attention',message:c.etat==='surchargée'?`Classe ${c.classe} surchargée : ${c.effectif} élèves pour ${c.capacite} places`:`Classe ${c.classe} sous-remplie : ${c.effectif} élèves pour ${c.capacite} places (${c.taux} %)`})),
   evolution_inscriptions:{nouvelles_par_annee_entree:entrees.map(e=>({annee:e.a,nouvelles:e.n})),eleves_factures_par_annee:factures.map(f=>({annee:f.a,effectif:f.n}))}}}
 // ---------- 2. Financier ----------
 async function financier(an){
  const attendu=(await one('SELECT COALESCE(SUM(montant_millimes),0) s FROM frais WHERE annee_scolaire=?',an)).s;
  const p=await one('SELECT COALESCE(SUM(montant_millimes),0) s,COALESCE(SUM(CASE WHEN simule=1 THEN montant_millimes ELSE 0 END),0) t FROM paiements WHERE annee_scolaire=? AND deleted_at IS NULL',an);
  const reel=p.s-p.t,S=await soldes(an),el=await eleves();
  const parents=await all("SELECT pe.eleve_id,u.nom FROM parent_eleve pe JOIN users u ON u.id=pe.parent_id WHERE u.deleted_at IS NULL");
  const retards=el.map(e=>({id:e.id,eleve:`${e.prenom} ${e.nom}`,classe:e.niveau?`${e.niveau} ${e.section}`:'—',parents:parents.filter(x=>x.eleve_id===e.id).map(x=>x.nom).join(', '),du:S.solde(e.id),dernier_paiement:S.dp[e.id]?S.dp[e.id].slice(0,10):null})).filter(x=>x.du>0).sort((a,b)=>b.du-a.du);
  const mois=await all("SELECT substr(date,1,7) m,SUM(montant_millimes) s FROM paiements WHERE deleted_at IS NULL GROUP BY substr(date,1,7) ORDER BY 1");
  const reste=attendu-p.s,hist=mois.filter(x=>x.m>=an.slice(0,4)+'-09'&&x.m<=an.slice(5)+'-06');
  const dernier=hist.slice(-4,-1),base=stats.moy(dernier.map(x=>x.s))||0,prevision=[];let cumul=0,[y,m]=(hist.length?hist[hist.length-1].m:`${an.slice(0,4)}-09`).split('-').map(Number);
  for(let k=1;k<=3;k++){m++;if(m>12){m=1;y++}const v=Math.max(0,Math.min(Math.round(base*Math.pow(0.8,k)),reste-cumul));cumul+=v;prevision.push({mois:`${y}-${String(m).padStart(2,'0')}`,montant_millimes:v})}
  const modes=await all('SELECT mode,SUM(montant_millimes) s,COUNT(*) n FROM paiements WHERE annee_scolaire=? AND deleted_at IS NULL GROUP BY mode',an);
  return{annee:an,kpis:{attendu_millimes:attendu,encaisse_millimes:reel,dont_test_millimes:p.t,reste_millimes:attendu-reel,taux_recouvrement:pct(reel,attendu),nb_eleves_en_retard:retards.length,nb_eleves:el.length},
   retards:retards.slice(0,25),evolution_mensuelle:mois.map(x=>({mois:x.m,montant_millimes:x.s})),prevision,par_mode:modes.map(x=>({mode:x.mode,montant_millimes:x.s,nombre:x.n})),
   note:p.t?`${p.t/1000} TND de paiements de TEST (simulés) sont exclus du recouvrement réel.`:null}}
 // ---------- 3. Pédagogique ----------
 async function pedagogique(an){
  const res=await resultats(),el=await eleves(),map=Object.fromEntries(el.map(e=>[e.id,e])),t=dernierT(res,an);
  const cur=res.filter(r=>r.an===an&&r.t===t&&map[r.eleve]);
  const grp=(keyf)=>{const o={};for(const r of cur){const k=keyf(map[r.eleve]);(o[k]=o[k]||[]).push(r.gen)}return Object.entries(o).map(([k,v])=>({nom:k,moyenne:r2(stats.moy(v)),effectif:v.length,taux_reussite:pct(v.filter(x=>x>=10).length,v.length)})).sort((a,b)=>a.nom.localeCompare(b.nom))};
  const mat={};for(const r of cur)for(const[k,v]of Object.entries(r.mat))(mat[k]=mat[k]||[]).push(v);
  const classement=Object.entries(mat).map(([k,v])=>({matiere:k,moyenne:r2(stats.moy(v))})).sort((a,b)=>b.moyenne-a.moyenne);
  const serie={};for(const r of res){const k=`${r.an}|T${r.t}`;(serie[k]=serie[k]||[]).push(r.gen)}
  const evolution=Object.entries(serie).sort().map(([k,v])=>({periode:k.replace('|',' '),moyenne:r2(stats.moy(v))}));
  const prevT3=Object.fromEntries(res.filter(r=>r.an===prec(an)&&r.t===3).map(r=>[r.eleve,r.gen]));
  const diff=cur.filter(r=>r.gen<10).sort((a,b)=>a.gen-b.gen).map(r=>({id:r.eleve,eleve:`${map[r.eleve].prenom} ${map[r.eleve].nom}`,classe:`${map[r.eleve].niveau} ${map[r.eleve].section}`,moyenne:r2(r.gen),
   faibles:Object.entries(r.mat).filter(([,v])=>v<10).map(([k])=>k)}));
  const accomp=cur.filter(r=>r.gen>=10&&prevT3[r.eleve]!==undefined&&prevT3[r.eleve]-r.gen>=2).map(r=>({id:r.eleve,eleve:`${map[r.eleve].prenom} ${map[r.eleve].nom}`,classe:`${map[r.eleve].niveau} ${map[r.eleve].section}`,baisse:r2(prevT3[r.eleve]-r.gen),moyenne:r2(r.gen)}));
  const gens=cur.map(r=>r.gen);
  return{annee:an,trimestre:t,kpis:{moyenne_generale:r2(stats.moy(gens)),taux_reussite:pct(gens.filter(x=>x>=10).length,gens.length),taux_echec:pct(gens.filter(x=>x<10).length,gens.length),eleves_evalues:gens.length,eleves_en_difficulte:diff.length},
   par_niveau:grp(e=>e.niveau),par_classe:grp(e=>`${e.niveau} ${e.section}`),classement_matieres:classement,evolution,eleves_en_difficulte:diff.slice(0,30),accompagnement_recommande:accomp.slice(0,30)}}
 // ---------- 4. Absences ----------
 async function absences(an){
  const el=await eleves(),ab=await all('SELECT eleve_id,date,justifiee FROM absences WHERE annee_scolaire=?',an),res=await resultats(),t=dernierT(res,an);
  const jours=Math.max(1,joursOuvres(debutAn(an),new Date(Math.min(Date.now(),Date.UTC(+an.slice(5),5,30))))),par={};
  for(const a of ab){(par[a.eleve_id]=par[a.eleve_id]||{n:0,nj:0});par[a.eleve_id].n++;if(!a.justifiee)par[a.eleve_id].nj++}
  const cl={};for(const e of el){const k=e.niveau?`${e.niveau} ${e.section}`:'—';(cl[k]=cl[k]||{classe:k,effectif:0,absences:0});cl[k].effectif++;cl[k].absences+=(par[e.id]||{n:0}).n}
  const mensuel={};for(const a of ab){const m=a.date.slice(0,7);(mensuel[m]=mensuel[m]||{mois:m,justifiees:0,non_justifiees:0})[a.justifiee?'justifiees':'non_justifiees']++}
  const gen=Object.fromEntries(res.filter(r=>r.an===an&&r.t===t).map(r=>[r.eleve,r.gen])),X=[],Y=[];for(const e of el)if(gen[e.id]!==undefined){X.push((par[e.id]||{n:0}).n);Y.push(gen[e.id])}
  const bucket=(lo,hi)=>{const v=X.map((x,i)=>x>=lo&&x<=hi?Y[i]:null).filter(x=>x!==null);return{effectif:v.length,moyenne:r2(stats.moy(v))}};
  const rep=el.filter(e=>par[e.id]&&(par[e.id].nj>=3||par[e.id].n>=5)).map(e=>({id:e.id,eleve:`${e.prenom} ${e.nom}`,classe:`${e.niveau} ${e.section}`,absences:par[e.id].n,non_justifiees:par[e.id].nj})).sort((a,b)=>b.absences-a.absences);
  const just=ab.filter(a=>a.justifiee).length;
  return{annee:an,jours_ouvres_ecoules:jours,kpis:{absences:ab.length,justifiees:just,non_justifiees:ab.length-just,taux_absenteisme:pct(ab.length,jours*el.length),eleves_absences_repetees:rep.length},
   par_classe:Object.values(cl).map(c=>({...c,absences_par_eleve:r2(c.absences/Math.max(1,c.effectif)),taux_absenteisme:pct(c.absences,jours*c.effectif)})).sort((a,b)=>b.taux_absenteisme-a.taux_absenteisme),
   evolution_mensuelle:Object.values(mensuel).sort((a,b)=>a.mois.localeCompare(b.mois)),absences_repetees:rep.slice(0,30),
   correlation_absences_resultats:{coefficient_r:r2(stats.r(X,Y)),lecture:'r proche de −1 : plus un élève s\'absente, plus sa moyenne baisse.',tranches:{'0 à 1 absence':bucket(0,1),'2 à 3 absences':bucket(2,3),'4 absences et plus':bucket(4,999)}}}}
 // ---------- 5. Enseignants ----------
 async function enseignants(an,q){
  const seuilMax=+q.surcharge||22,seuilMin=+q.souscharge||14;
  const ens=await all("SELECT id,nom FROM users WHERE role='enseignant' AND deleted_at IS NULL"),cr=await all('SELECT c.enseignant_id,c.debut,c.fin,m.nom matiere,m.niveau FROM creneaux c JOIN matieres m ON m.id=c.matiere_id WHERE c.annee_scolaire=?',an);
  const aff=await all('SELECT DISTINCT a.enseignant_id,m.nom matiere,m.niveau FROM affectations a JOIN matieres m ON m.id=a.matiere_id WHERE a.annee_scolaire=?',an);
  const h={};for(const c of cr)h[c.enseignant_id]=(h[c.enseignant_id]||0)+(hm(c.fin)-hm(c.debut))/60;
  const charge=ens.map(e=>{const x=h[e.id]||0;return{id:e.id,enseignant:e.nom,heures_hebdo:r1(x),etat:x>seuilMax?'surcharge':x<seuilMin?'sous-charge':'normale'}}).sort((a,b)=>b.heures_hebdo-a.heures_hebdo);
  const parMat={},parNiv={},hMat={};for(const a of aff){(parMat[a.matiere]=parMat[a.matiere]||new Set()).add(a.enseignant_id);(parNiv[a.niveau]=parNiv[a.niveau]||new Set()).add(a.enseignant_id)}
  for(const c of cr)hMat[c.matiere]=(hMat[c.matiere]||0)+(hm(c.fin)-hm(c.debut))/60;
  return{annee:an,seuils:{surcharge_heures:seuilMax,sous_charge_heures:seuilMin},kpis:{enseignants:ens.length,heures_totales:r1(Object.values(h).reduce((s,x)=>s+x,0)),charge_moyenne:r1(stats.moy(charge.map(c=>c.heures_hebdo))),en_surcharge:charge.filter(c=>c.etat==='surcharge').length,en_sous_charge:charge.filter(c=>c.etat==='sous-charge').length},
   par_matiere:Object.entries(parMat).map(([k,v])=>({matiere:k,enseignants:v.size,heures:r1(hMat[k]||0)})),par_niveau:Object.entries(parNiv).map(([k,v])=>({niveau:k,enseignants:v.size})).sort((a,b)=>a.niveau.localeCompare(b.niveau)),charge,
   absences_remplacements:{disponible:false,message:'Les absences et remplacements des enseignants ne sont pas encore saisis dans l\'application (module à venir).'}}}
 // ---------- 7. Communications ----------
 async function communications(){
  const il=n=>new Date(Date.now()-n*864e5).toISOString().replace('T',' ').slice(0,19);
  const m=await one('SELECT COUNT(*) n FROM messages WHERE brouillon=0'),m30=await one('SELECT COUNT(*) n FROM messages WHERE brouillon=0 AND created_at>=?',il(30));
  const parRole=await all('SELECT u.role,COUNT(*) n FROM messages m JOIN users u ON u.id=m.expediteur_id WHERE m.brouillon=0 GROUP BY u.role');
  const n=await all("SELECT n.user_id,u.nom,COUNT(*) total,SUM(n.lue) lues FROM notifications n JOIN users u ON u.id=n.user_id WHERE u.role='parent' AND u.deleted_at IS NULL GROUP BY n.user_id,u.nom");
  const tot=n.reduce((s,x)=>s+x.total,0),lues=n.reduce((s,x)=>s+(x.lues||0),0),sil=n.filter(x=>x.total>=3&&!(x.lues>0));
  const enf=await all('SELECT pe.parent_id,e.prenom,e.nom FROM parent_eleve pe JOIN eleves e ON e.id=pe.eleve_id WHERE e.deleted_at IS NULL');
  const recl=await one("SELECT COUNT(*) n FROM messages m JOIN users s ON s.id=m.expediteur_id JOIN users d ON d.id=m.destinataire_id WHERE s.role='parent' AND d.role IN('admin','directeur') AND m.created_at>=?",il(60));
  return{kpis:{messages_envoyes:m.n,messages_30_jours:m30.n,notifications_parents:tot,taux_lecture_notifications:pct(lues,tot),parents_ne_consultant_pas:sil.length,parents_total:n.length,reclamations_60_jours:recl.n},
   messages_par_role:parRole.map(x=>({role:x.role,nombre:x.n})),
   parents_a_relancer:sil.slice(0,25).map(p=>({parent:p.nom,notifications_non_lues:p.total,enfants:enf.filter(e=>e.parent_id===p.user_id).map(e=>`${e.prenom} ${e.nom}`).join(', ')})),
   recommandation:sil.length?`${sil.length} parent(s) n'ouvrent jamais les notifications : privilégier un appel téléphonique ou un message au guichet.`:null}}
 // ---------- 8. Emplois du temps & salles ----------
 async function salles(an){
  const sal=await all('SELECT id,nom,capacite FROM salles WHERE deleted_at IS NULL'),cr=await all('SELECT * FROM creneaux WHERE annee_scolaire=?',an),DISPO=63*60;
  const mins={};for(const c of cr)mins[c.salle_id]=(mins[c.salle_id]||0)+hm(c.fin)-hm(c.debut);
  const occ=sal.map(s=>({salle:s.nom,capacite:s.capacite,heures:r1((mins[s.id]||0)/60),taux_occupation:pct(mins[s.id]||0,DISPO)})).sort((a,b)=>b.taux_occupation-a.taux_occupation);
  const conflits=[];for(const[cle,lib]of[['enseignant_id','enseignant'],['salle_id','salle'],['classe_id','classe']]){const g={};for(const c of cr)(g[c[cle]+'|'+c.jour]=g[c[cle]+'|'+c.jour]||[]).push(c);
   for(const l of Object.values(g)){l.sort((a,b)=>hm(a.debut)-hm(b.debut));for(let i=1;i<l.length;i++)if(hm(l[i].debut)<hm(l[i-1].fin))conflits.push({type:lib,jour:l[i].jour,debut:l[i].debut})}}
  const parJour=[1,2,3,4,5,6].map(j=>({jour:j,heures:r1(cr.filter(c=>c.jour===j).reduce((s,c)=>s+hm(c.fin)-hm(c.debut),0)/60)})),hs=parJour.slice(0,5).map(x=>x.heures);
  return{annee:an,kpis:{salles:sal.length,taux_occupation_moyen:r1(stats.moy(occ.map(o=>o.taux_occupation))),salles_sous_utilisees:occ.filter(o=>o.taux_occupation<25).length,conflits_horaires:conflits.length,heures_planifiees:r1(cr.reduce((s,c)=>s+hm(c.fin)-hm(c.debut),0)/60)},
   occupation_salles:occ,sous_utilisees:occ.filter(o=>o.taux_occupation<25),conflits,repartition_par_jour:parJour,equilibre:{ecart_type_jours:r2(Math.sqrt(stats.moy(hs.map(x=>(x-stats.moy(hs))**2)))),lecture:'Un écart-type faible indique des journées équilibrées (lun.→ven.).'}}}
 // ---------- 9. Early Warning System ----------
 async function risques(an){
  const el=await eleves(),res=await resultats(),t=dernierT(res,an),S=await soldes(an),ab=await all('SELECT eleve_id,justifiee FROM absences WHERE annee_scolaire=?',an);
  const gen=Object.fromEntries(res.filter(r=>r.an===an&&r.t===t).map(r=>[r.eleve,r.gen])),pv=Object.fromEntries(res.filter(r=>r.an===prec(an)&&r.t===3).map(r=>[r.eleve,r.gen]));
  const A={};for(const a of ab){(A[a.eleve_id]=A[a.eleve_id]||{n:0,nj:0});A[a.eleve_id].n++;if(!a.justifiee)A[a.eleve_id].nj++}
  const out=[];
  for(const e of el){const g=gen[e.id],a=A[e.id]||{n:0,nj:0},du=S.solde(e.id),fr=S.f[e.id]||0,raisons=[],types=new Set();let s=0;
   const baisse=g!==undefined&&pv[e.id]!==undefined&&pv[e.id]-g>=2,repetees=a.nj>=3||a.n>=5,impaye=fr>0&&du/fr>=0.5,inactif=du>0&&(!S.dp[e.id]||(Date.now()-new Date(S.dp[e.id]).getTime())>45*864e5);
   if(g!==undefined&&g<10){s+=40;raisons.push(`moyenne ${r1(g)}/20`);types.add('echec')}else if(g!==undefined&&g<11){s+=15;raisons.push(`moyenne limite ${r1(g)}/20`)}
   if(baisse){s+=15;raisons.push(`baisse de ${r1(pv[e.id]-g)} points depuis l'an dernier`)}
   if(repetees){s+=20;raisons.push(`${a.n} absences dont ${a.nj} non justifiées`);}
   if(a.n>=8){s+=10}
   if(repetees&&baisse){types.add('double');s+=10}
   if(impaye){s+=15;raisons.push(`impayé ${r1(du/1000)} TND`);types.add('impaye')}else if(du>0&&inactif){s+=8;types.add('impaye');raisons.push('aucun paiement depuis plus de 45 jours')}
   if(a.nj>=5&&(impaye||(g!==undefined&&g<10))){types.add('abandon');s+=10}
   if(s>=30)out.push({id:e.id,eleve:`${e.prenom} ${e.nom}`,classe:e.niveau?`${e.niveau} ${e.section}`:'—',score:Math.min(100,s),niveau:s>=60?'élevé':s>=45?'moyen':'faible',categories:[...types],raisons})}
  out.sort((a,b)=>b.score-a.score);const c=k=>out.filter(x=>x.categories.includes(k)).length;
  return{annee:an,kpis:{eleves_a_risque:out.length,risque_eleve:out.filter(x=>x.niveau==='élevé').length,risque_echec:c('echec'),risque_abandon:c('abandon'),absences_et_baisse:c('double'),risque_impaye:c('impaye')},
   methode:'Score = moyenne <10 (+40), moyenne limite (+15), baisse ≥2 pts (+15), absences répétées (+20), impayé ≥50 % (+15), cumul absences+baisse (+10)… Seuil d\'alerte : 30.',
   alertes:out.slice(0,40),repartition_par_niveau:Object.entries(out.reduce((o,x)=>(o[x.classe.split(' ')[0]+' '+(x.classe.split(' ')[1]||'')]=(o[x.classe.split(' ')[0]+' '+(x.classe.split(' ')[1]||'')]||0)+1,o),{})).map(([k,v])=>({classe:k,eleves_a_risque:v}))}}
 // ---------- 10. Stratégique ----------
 async function strategique(an,q){
  const g=await general(an),f=await financier(an),p=await pedagogique(an),ri=await risques(an),sa=await salles(an),en=await enseignants(an,{});
  const hist=g.evolution_inscriptions.eleves_factures_par_annee,pts=hist.map(h=>[+h.annee.slice(0,4),h.effectif]),reg=stats.reg(pts),courant=g.kpis.eleves,nxt=+an.slice(0,4)+1;
  const tendance=reg&&pts.length>=3?Math.round(Math.min(courant*1.15,Math.max(courant*0.85,reg.a+reg.b*nxt))):courant,capCible=+q.capacite_cible||25;
  const scen=(taux,nom)=>{const eff=Math.round(courant*(1+taux/100)),cl=Math.ceil(eff/capCible),spec=2*Math.ceil(cl/12);return{scenario:nom,croissance_pct:taux,effectif_prevu:eff,classes_necessaires:cl,enseignants_necessaires:cl+spec,salles_necessaires:cl+3,deficit_classes:cl-g.kpis.classes,deficit_enseignants:cl+spec-en.kpis.enseignants,deficit_salles:cl+3-sa.kpis.salles}};
  const scenarios=[scen(-5,'Pessimiste'),scen(0,'Stable'),scen(5,'Croissance modérée'),scen(10,'Forte croissance')];if(q.croissance!==undefined&&q.croissance!=='')scenarios.push(scen(+q.croissance,'Personnalisé'));
  const rec=[];
  for(const a of g.alertes)rec.push({priorite:a.niveau==='danger'?'haute':'moyenne',domaine:'Effectifs',action:a.niveau==='danger'?`${a.message} : ouvrir une section ou rééquilibrer les affectations.`:`${a.message} : regrouper ou promouvoir l'inscription.`});
  if(f.kpis.taux_recouvrement!==null&&f.kpis.taux_recouvrement<80)rec.push({priorite:f.kpis.taux_recouvrement<60?'haute':'moyenne',domaine:'Finances',action:`Taux de recouvrement de ${f.kpis.taux_recouvrement} % : lancer les relances (${f.kpis.nb_eleves_en_retard} familles en retard) et proposer un échéancier.`});
  if(p.kpis.taux_echec>=20)rec.push({priorite:'haute',domaine:'Pédagogie',action:`Taux d'échec de ${p.kpis.taux_echec} % : mettre en place du soutien, en priorité en « ${(p.classement_matieres[p.classement_matieres.length-1]||{}).matiere} » (matière la plus faible).`});
  if(ri.kpis.risque_eleve>0)rec.push({priorite:'haute',domaine:'Suivi des élèves',action:`${ri.kpis.risque_eleve} élève(s) à risque élevé : convoquer les familles et définir un plan d'accompagnement individuel.`});
  if(sa.kpis.salles_sous_utilisees>0)rec.push({priorite:'basse',domaine:'Ressources',action:`${sa.kpis.salles_sous_utilisees} salle(s) sous-utilisée(s) (${sa.sous_utilisees.map(s=>s.salle).join(', ')}) : envisager de les affecter à du soutien ou des activités.`});
  if(en.kpis.en_sous_charge>0)rec.push({priorite:'basse',domaine:'Ressources humaines',action:`${en.kpis.en_sous_charge} enseignant(s) en sous-charge : leur confier du soutien scolaire ou des remplacements.`});
  const recouv=await all('SELECT annee_scolaire a,SUM(montant_millimes) s FROM frais GROUP BY annee_scolaire'),paye=Object.fromEntries((await all('SELECT annee_scolaire a,SUM(montant_millimes) s FROM paiements WHERE deleted_at IS NULL GROUP BY annee_scolaire')).map(x=>[x.a,x.s]));
  const res=await resultats(),parAn={};for(const r of res)(parAn[r.an]=parAn[r.an]||[]).push(r.gen);
  const nAbs=Object.fromEntries((await all('SELECT annee_scolaire a,COUNT(*) n FROM absences GROUP BY annee_scolaire')).map(x=>[x.a,x.n]));
  return{annee:an,kpis:{effectif_actuel:courant,prevision_annee_suivante:tendance,methode_prevision:reg&&pts.length>=3?`Régression linéaire sur ${pts.length} années (élèves facturés), bornée à ±15 % — indicatif`:'Moins de 3 années d\'historique : effectif supposé stable (utilisez les scénarios)'},
   historique_effectifs:hist,scenarios,comparaison_annees:recouv.map(r=>({annee:r.a,effectif:(hist.find(h=>h.annee===r.a)||{}).effectif||null,moyenne_generale:r2(stats.moy(parAn[r.a]||[])),taux_recouvrement:pct(paye[r.a]||0,r.s),absences:nAbs[r.a]||0})).sort((a,b)=>a.annee.localeCompare(b.annee)),
   recommandations:rec.sort((a,b)=>({haute:0,moyenne:1,basse:2}[a.priorite]-{haute:0,moyenne:1,basse:2}[b.priorite])),
   depenses:{disponible:false,message:'Les dépenses de l\'école ne sont pas saisies dans l\'application : la prévision porte sur les recettes et les besoins en ressources.'}}}
 const T={general,financier,pedagogique,absences,enseignants,communications,salles,risques,strategique};
 app.get('/api/bi',auth,roles('admin','comptable'),(q,r)=>r.json({tableaux:Object.keys(T).filter(k=>q.user.role==='admin'||k==='financier')}));
 app.get('/api/bi/:t',auth,roles('admin','comptable'),async(q,r)=>{
  const f=T[q.params.t];if(!f)return r.status(404).json({erreur:'Tableau de bord inconnu'});
  if(q.user.role==='comptable'&&q.params.t!=='financier')return r.status(403).json({erreur:'Accès refusé'});
  const an=/^\d{4}-\d{4}$/.test(q.query.annee||'')?q.query.annee:await anneeActive();if(!an)return r.status(409).json({erreur:'Aucune année scolaire active'});
  r.json(await f(an,q.query))})};
