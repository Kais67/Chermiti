// Jeu de données de démonstration 100 % FICTIF et déterministe pour une école (alimente les tableaux de bord BI).
// Contenu : 12 classes (6 niveaux × 2 sections), ~110 élèves, 14 enseignants, parents, 2 années scolaires (historique 2025-2026),
// notes, absences, frais/paiements étalés sur l'année, messages, notifications, emplois du temps sans conflit.
const bcrypt=require('bcryptjs');
const PRENOMS=['Sarra','Yassine','Mariem','Aymen','Nour','Omar','Ines','Amine','Rym','Mehdi','Lina','Hedi','Salma','Karim','Eya','Slim','Farah','Walid','Asma','Rami','Yasmine','Bilel','Molka','Anis','Cyrine','Fares','Ghada','Haythem','Khadija','Iyed'];
const NOMS=['Ben Salah','Trabelsi','Jebali','Mansouri','Gharbi','Bouazizi','Chaouch','Hamdi','Saidi','Mejri','Dridi','Karoui','Khelifi','Ouni','Zouari','Ayari','Bahri','Cherif','Nasri','Rezgui'];
const NIVEAUX=['1re année','2e année','3e année','4e année','5e année','6e année'];
const MATIERES=[['Arabe',3],['Français',3],['Mathématiques',3],['Éveil scientifique',2],['Anglais',1],['Éducation physique',1]];
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const pad=n=>String(n).padStart(2,'0');
async function seedEcole(db,{code='a',nomEcole,password,seed=1,adminEmail,annee='2026-2027',precedente='2025-2026'}){
 const R=rng(seed),pick=a=>a[Math.floor(R()*a.length)],norm=()=>{let s=0;for(let i=0;i<6;i++)s+=R();return(s-3)/0.7071},clip=(x,a,b)=>Math.max(a,Math.min(b,x));
 const hash=bcrypt.hashSync(password,8),email=(r,i)=>i===undefined?`${r}.${code}@demo.tn`:`${r}${i}.${code}@demo.tn`;
 const run=(sql,...p)=>db.prepare(sql).run(...p),id=async(sql,...p)=>(await run(sql,...p)).lastInsertRowid;
 await db.transaction(async()=>{
  for(const[l,a]of[[precedente,0],[annee,1]])if(!(await db.prepare('SELECT 1 FROM annees_scolaires WHERE libelle=?').get(l)))await run('INSERT INTO annees_scolaires(libelle,active) VALUES(?,?)',l,a);
  await run('UPDATE annees_scolaires SET active=CASE WHEN libelle=? THEN 1 ELSE 0 END',annee);
  const user=(e,nom,role,tel)=>id('INSERT INTO users(email,password_hash,nom,role,telephone) VALUES(?,?,?,?,?)',e,hash,nom,role,tel||null);
  const admin=await db.prepare('SELECT id FROM users WHERE email=?').get(adminEmail||email('admin'))||{id:await user(email('admin'),'Administrateur '+code.toUpperCase(),'admin')};
  await user(email('directeur'),'Directeur '+code.toUpperCase(),'directeur');const compta=await user(email('comptable'),'Comptable '+code.toUpperCase(),'comptable');
  // Matières par niveau
  const mat={};for(const n of NIVEAUX){mat[n]=[];for(const[nom,c]of MATIERES)mat[n].push({id:await id('INSERT INTO matieres(nom,coefficient,niveau) VALUES(?,?,?)',nom,c,n),nom,coef:c})}
  // Salles : une par classe + salle polyvalente, gymnase, bibliothèque (volontairement peu utilisée)
  const salles=[];for(let i=1;i<=12;i++)salles.push(await id('INSERT INTO salles(nom,capacite) VALUES(?,?)','Salle '+i,30));
  const poly=await id('INSERT INTO salles(nom,capacite) VALUES(?,?)','Salle polyvalente',35),gym=await id('INSERT INTO salles(nom,capacite) VALUES(?,?)','Gymnase',40);await run('INSERT INTO salles(nom,capacite) VALUES(?,?)','Bibliothèque',30);
  // Enseignants : 12 titulaires (1 par classe) + 2 spécialistes (anglais, éducation physique)
  const profs=[];for(let i=1;i<=12;i++)profs.push(await user(i===1?email('enseignant'):email('prof',i),(i===1?'Enseignant ':'Enseignant ')+code.toUpperCase()+i,'enseignant','2000'+pad(i)+'00'));
  const sAng=await user(email('prof',13),'Enseignant Anglais '+code.toUpperCase(),'enseignant'),sEps=await user(email('prof',14),'Enseignant Sport '+code.toUpperCase(),'enseignant');
  // Classes
  const classes=[];let ci=0;
  for(const n of NIVEAUX)for(const sec of['A','B']){const cap=[20,22,25,25,28,30][NIVEAUX.indexOf(n)]+(sec==='B'?-2:0);
   const c={id:await id('INSERT INTO classes(niveau,section,capacite,titulaire_id,annee_scolaire) VALUES(?,?,?,?,?)',n,sec,cap,profs[ci],annee),niveau:n,cap,idx:ci,titulaire:profs[ci],eleves:[]};
   for(const m of mat[n]){const t=m.nom==='Anglais'?sAng:m.nom==='Éducation physique'?sEps:profs[ci];await run('INSERT INTO affectations(enseignant_id,matiere_id,classe_id,annee_scolaire) VALUES(?,?,?,?)',t,m.id,c.id,annee)}
   classes.push(c);ci++}
  // Emploi du temps (sans conflit). 5 créneaux/jour (3 le mercredi), anglais et sport placés sur des créneaux uniques par classe.
  const SL=[['08:00','09:00'],['09:00','10:00'],['10:15','11:15'],['11:15','12:15'],['14:00','15:00']];
  for(const c of classes){const i=c.idx,used=new Set(),eng=[(i%5)+1,Math.floor(i/5)],eps=i<10?[(i%5)+1,3+Math.floor(i/5)]:[6,i-10];
   const put=async(j,s,mm,t,sa)=>{await run('INSERT INTO creneaux(classe_id,matiere_id,enseignant_id,salle_id,jour,debut,fin,annee_scolaire) VALUES(?,?,?,?,?,?,?,?)',c.id,mm.id,t,sa,j,SL[s][0],SL[s][1],annee);used.add(j+':'+s)};
   const ang=mat[c.niveau].find(m=>m.nom==='Anglais'),sp=mat[c.niveau].find(m=>m.nom==='Éducation physique');
   await put(eng[0],eng[1],ang,sAng,poly);await put(eps[0],eps[1],sp,sEps,gym);
   const core=mat[c.niveau].filter(m=>m.coef>=2);let k=0;
   for(let j=1;j<=5;j++)for(let s=0;s<(j===3?3:5);s++){if(used.has(j+':'+s))continue;await put(j,s,core[k++%core.length],c.titulaire,salles[i])}}
  // Élèves (annee_entree étalée sur 6 ans : alimente l'évolution des inscriptions)
  const parents=[];let nEleves=0;
  for(const c of classes){const n=Math.max(6,Math.round(c.cap*(c.idx%5===0?1.12:c.idx%7===3?0.45:0.62+R()*0.34)));
   for(let k=0;k<n;k++){const nom=pick(NOMS),prenom=pick(PRENOMS),niv=NIVEAUX.indexOf(c.niveau),entree=2026-Math.min(niv,Math.floor(R()*(niv+1)))-(R()<0.15?0:0);
    const naiss=`${2026-6-niv-(R()<0.3?1:0)}-${pad(1+Math.floor(R()*12))}-${pad(1+Math.floor(R()*28))}`;
    const eid=await id('INSERT INTO eleves(nom,prenom,date_naissance,classe_id,annee_entree,annee_scolaire) VALUES(?,?,?,?,?,?)',nom,prenom,naiss,c.id,String(Math.max(entree,2021)),annee);
    const e={id:eid,c,niv,abil:clip(12+norm()*2.6,4,18.5),declin:R()<0.12,assidu:R()<0.12,nouveau:Math.max(entree,2021)>=2026,pay:R()};c.eleves.push(e);nEleves++;
    if(c.eleves.length%3!==0||!parents.length){const p=await user(email('parent',parents.length+1),'Parent '+nom+' '+(parents.length+1),'parent','9'+pad(10+parents.length%80)+'0'+pad(parents.length%90)+pad(11+parents.length%80));parents.push(p);e.parent=p}else e.parent=parents[parents.length-1];
    await run('INSERT INTO parent_eleve(parent_id,eleve_id) VALUES(?,?)',e.parent,eid)}}
  // Comptes nommés pour les tests : parent.<code>@demo.tn et eleve.<code>@demo.tn (même famille, classe de 3e année A)
  const cible=classes[4].eleves[0];await run('UPDATE users SET email=?,nom=? WHERE id=?',email('parent'),'Parent '+code.toUpperCase()+' (test)',cible.parent);
  const ue=await user(email('eleve'),'Élève '+code.toUpperCase()+' (test)','eleve');await run('UPDATE eleves SET user_id=?,nom=?,prenom=? WHERE id=?',ue,'Test','Élève'+code.toUpperCase(),cible.id);
  // Frais + paiements : 2026-2027 en cours, 2025-2026 presque soldée (étalement mensuel)
  const FR=[['Inscription',50000],['Scolarité',600000]];
  const paie=async(e,an,debut,fin,ratio)=>{let du=0;for(const[l,m]of FR){await run('INSERT INTO frais(eleve_id,libelle,montant_millimes,annee_scolaire) VALUES(?,?,?,?)',e.id,l+' '+an,m,an);du+=m}
   let reste=du,vers=Math.round(du*ratio/1000)*1000;const nb=ratio>=0.95?3:ratio>0?1+Math.floor(R()*3):0;
   for(let k=0;k<nb&&vers>0;k++){const part=k===nb-1?vers:Math.round(vers/nb/1000)*1000,mt=Math.min(part,reste);if(mt<=0)break;
    const d=new Date(debut+(fin-debut)*(k+R()*0.6)/nb);reste-=mt;vers-=mt;
    await run('INSERT INTO paiements(eleve_id,montant_millimes,mode,date,solde_apres_millimes,annee_scolaire,canal,simule) VALUES(?,?,?,?,?,?,?,0)',e.id,mt,pick(['especes','especes','virement','mobile_money']),d.toISOString(),reste,an,'guichet')}};
  const D=(a,m,j)=>Date.UTC(a,m-1,j);
  for(const c of classes)for(const e of c.eleves){const r=e.pay;await paie(e,annee,D(2026,9,2),D(2026,11,17),r<0.50?1:r<0.75?0.35+R()*0.4:r<0.88?0.1:0);if(!e.nouveau)await paie(e,precedente,D(2025,9,2),D(2026,6,20),R()<0.92?1:0.8)}
  // Notes : T1 2026-2027 ; T1→T3 2025-2026 (élèves non nouveaux). 2 évaluations par matière et trimestre.
  const notes=async(an,trims,filtre)=>{for(const c of classes){for(const m of mat[c.niveau])for(const t of trims)for(const[titre,type]of[['Contrôle','controle_continu'],['Examen','examen']]){
    const ev=await id('INSERT INTO evaluations(classe_id,matiere_id,titre,trimestre,type,bareme,annee_scolaire) VALUES(?,?,?,?,?,20,?)',c.id,m.id,`${titre} ${m.nom} T${t}`,t,type,an);
    for(const e of c.eleves){if(!filtre(e))continue;const v=clip(e.abil+norm()*1.6-(e.declin&&an===annee?3.2:0)+(m.nom==='Éducation physique'?2:0)+(an===precedente?0.6:0),0,20);
     await run('INSERT INTO notes(evaluation_id,eleve_id,valeur,annee_scolaire) VALUES(?,?,?,?)',ev,e.id,Math.round(v*4)/4,an)}}}};
  await notes(precedente,[1,2,3],e=>!e.nouveau);await notes(annee,[1],()=>true);
  // Absences : plus nombreuses pour les élèves en déclin ; dates ouvrées
  const jour=(a,m,j0,j1)=>{let d;do{d=new Date(D(a,m,j0+Math.floor(R()*(j1-j0+1))))}while([0,6].includes(d.getUTCDay()));return d.toISOString().slice(0,10)};
  for(const c of classes)for(const e of c.eleves){const nb=Math.floor((e.assidu?0:R()*3.2)+(e.declin?3+R()*5:0)),nbp=e.nouveau?0:Math.floor(R()*4+(e.declin?4:0));
   for(let k=0;k<nb;k++){const m=pick([9,10,10,11]),j=R()<0.45?1:0;await run('INSERT INTO absences(eleve_id,date,motif,justifiee,justification,annee_scolaire) VALUES(?,?,?,?,?,?)',e.id,jour(2026,m,m===11?1:3,m===11?16:27),j?'Maladie':null,j,j?'Certificat médical':null,annee)}
   for(let k=0;k<nbp;k++){const m=pick([10,11,12,1,2,3,4,5]),y=m>=9?2025:2026;await run('INSERT INTO absences(eleve_id,date,motif,justifiee,annee_scolaire) VALUES(?,?,?,?,?)',e.id,jour(y,m,3,27),null,R()<0.5?1:0,precedente)}}
  // Communication : messages enseignants→parents, réclamations parents→administration, notifications (lues ou non)
  for(const c of classes)for(const e of c.eleves.slice(0,4))if(R()<0.8)await run('INSERT INTO messages(expediteur_id,destinataire_id,objet,corps,eleve_id,created_at) VALUES(?,?,?,?,?,?)',c.titulaire,e.parent,'Suivi de '+e.id,'Bonjour, point sur le travail de votre enfant.',e.id,`2026-${pad(10+Math.floor(R()*2))}-${pad(1+Math.floor(R()*17))} 10:00:00`);
  for(const p of parents.slice(0,14))await run('INSERT INTO messages(expediteur_id,destinataire_id,objet,corps,created_at) VALUES(?,?,?,?,?)',p,admin.id,'Réclamation / demande','Demande concernant les frais ou le planning.',`2026-11-${pad(1+Math.floor(R()*16))} 09:00:00`);
  const silencieux=new Set(parents.filter(()=>R()<0.18));
  for(const p of parents){const nb=2+Math.floor(R()*5);for(let k=0;k<nb;k++)await run('INSERT INTO notifications(user_id,texte,lue,created_at) VALUES(?,?,?,?)',p,'Nouvelle information de l\'école',silencieux.has(p)?0:(R()<0.7?1:0),`2026-11-${pad(1+Math.floor(R()*17))} 08:00:00`)}
  for(const[t,c]of[['Rentrée scolaire','Bienvenue à tous.'],['Réunion parents-enseignants','Samedi 28 novembre à 10h.'],['Collecte de vêtements','Merci pour votre générosité.']])await run('INSERT INTO annonces(auteur_id,titre,corps,cible) VALUES(?,?,?,?)',admin.id,t,c,'tous');
  for(let i=0;i<6;i++)await run('INSERT INTO preinscriptions(nom,prenom,date_naissance,parent_nom,parent_email,consentement,statut) VALUES(?,?,?,?,?,1,?)',pick(NOMS),pick(PRENOMS),'2020-0'+(1+i)+'-10','Parent démo','futur'+i+'.'+code+'@demo.tn',['en_attente','en_attente','validee','validee','refusee','en_attente'][i]);
  const prof1=classes[0];for(const m of mat[prof1.niveau].slice(0,2))await run('INSERT INTO devoirs(classe_id,matiere_id,enseignant_id,titre,description,date_remise,annee_scolaire) VALUES(?,?,?,?,?,?,?)',prof1.id,m.id,prof1.titulaire,'Exercices '+m.nom,'Page 12 à 14','2026-12-05T17:00:00.000Z',annee);
  void compta;
 })();
 return{eleves:(await db.prepare('SELECT COUNT(*) n FROM eleves').get()).n}}
const ECOLES=[{slug:'ecole-a',code:'a',nom:'École Abou El Kacem Chebbi (démo A)',password:'DemoEcoleA#2026',seed:11,langue:'fr'},{slug:'ecole-b',code:'b',nom:'École Ibn Khaldoun (démo B)',password:'DemoEcoleB#2026',seed:23,langue:'fr'}];
module.exports={seedEcole,ECOLES};
