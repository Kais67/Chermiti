// Données de démonstration 100 % fictives. Refusé en production.
require('dotenv').config({path:require('path').join(__dirname,'../../.env')});
if(process.env.NODE_ENV==='production'&&process.env.ALLOW_DEMO_SEED!=='true'){console.error('Seed interdit en production.');process.exit(1)}
const bcrypt=require('bcryptjs'),{open}=require('../src/db'),pay=require('../src/services/payments'),db=open();
if(db.prepare('SELECT COUNT(*) n FROM users').get().n>0){console.log('La base contient déjà des utilisateurs : seed ignoré.');process.exit(0)}
const PW=process.env.DEMO_PASSWORD||'Demo2026!',h=bcrypt.hashSync(PW,10),AN='2026-2027';
const U=(e,n,r)=>db.prepare('INSERT INTO users(email,password_hash,nom,role) VALUES(?,?,?,?)').run(e,h,n,r).lastInsertRowid;
db.transaction(()=>{
 db.prepare('INSERT INTO annees_scolaires(libelle,active) VALUES(?,1)').run(AN);
 const admin=U('admin@ecole.demo','Direction (démo)','admin'),prof=U('prof@ecole.demo','Mme Prof Démo','enseignant'),prof2=U('prof2@ecole.demo','M. Maître Démo','enseignant'),
  parent=U('parent@ecole.demo','Parent Démo','parent'),eleveU=U('eleve@ecole.demo','Sarra Démo','eleve'),compta=U('compta@ecole.demo','Secrétariat Démo','comptable');
 const cl=db.prepare('INSERT INTO classes(niveau,section,capacite,titulaire_id,annee_scolaire) VALUES(?,?,?,?,?)');
 const cp=cl.run('1re année','A',25,prof,AN).lastInsertRowid,ce=cl.run('2e année','A',25,prof2,AN).lastInsertRowid;
 const mt=db.prepare('INSERT INTO matieres(nom,coefficient,niveau) VALUES(?,?,?)'),m={};
 for(const[n,c]of[['Arabe',3],['Français',3],['Mathématiques',3],['Éveil scientifique',1],['Éducation islamique',1]])m[n]=mt.run(n,c,'1re année').lastInsertRowid;
 const s1=db.prepare('INSERT INTO salles(nom,capacite,disponible) VALUES(?,?,1)').run('Salle 1',30).lastInsertRowid,s2=db.prepare('INSERT INTO salles(nom,capacite,disponible) VALUES(?,?,1)').run('Salle 2',30).lastInsertRowid;
 const el=db.prepare('INSERT INTO eleves(nom,prenom,date_naissance,classe_id,user_id,annee_entree,annee_scolaire) VALUES(?,?,?,?,?,?,?)');
 const e1=el.run('Démo','Sarra','2020-03-12',cp,eleveU,'2026',AN).lastInsertRowid,e2=el.run('Démo','Yassine','2020-07-02',cp,null,'2026',AN).lastInsertRowid,e3=el.run('Exemple','Amel','2019-11-21',cp,null,'2026',AN).lastInsertRowid;
 for(const e of[e1,e2])db.prepare('INSERT INTO parent_eleve VALUES(?,?)').run(parent,e);
 const cr=db.prepare('INSERT INTO creneaux(classe_id,matiere_id,enseignant_id,salle_id,jour,debut,fin,annee_scolaire) VALUES(?,?,?,?,?,?,?,?)');
 cr.run(cp,m['Arabe'],prof,s1,1,'08:00','09:00',AN);cr.run(cp,m['Mathématiques'],prof,s1,1,'09:00','10:00',AN);cr.run(cp,m['Français'],prof,s1,2,'08:00','09:00',AN);cr.run(cp,m['Éveil scientifique'],prof2,s2,3,'10:00','11:00',AN);
 const ev=db.prepare('INSERT INTO evaluations(classe_id,matiere_id,titre,trimestre,bareme,annee_scolaire) VALUES(?,?,?,?,20,?)');
 const nt=db.prepare('INSERT INTO notes(evaluation_id,eleve_id,valeur,annee_scolaire) VALUES(?,?,?,?)');
 for(const[n,v1,v2]of[['Arabe',16,12],['Français',14,15],['Mathématiques',18,11],['Éveil scientifique',12,9],['Éducation islamique',15,13]]){const i=ev.run(cp,m[n],'Contrôle continu 1',1,AN).lastInsertRowid;nt.run(i,e1,v1,AN);nt.run(i,e2,v2,AN)}
 const fr=db.prepare('INSERT INTO frais(eleve_id,libelle,montant_millimes,annee_scolaire) VALUES(?,?,?,?)');
 for(const e of[e1,e2,e3]){fr.run(e,'Inscription',100000,AN);fr.run(e,'Scolarité - 1re tranche',400000,AN)}
 pay.enregistrer(db,{eleveId:e1,montant:300000,mode:'especes',annee:AN,userId:compta});
 const fe=db.prepare('INSERT INTO felicitations(eleve_id,enseignant_id,motif,icone,annee_scolaire) VALUES(?,?,?,?,?)');fe.run(e1,prof,'Très bon travail','trophee',AN);fe.run(e1,prof,'Aide à un camarade','coeur',AN);fe.run(e2,prof,'Progrès remarquable','fusee',AN);
 db.prepare('INSERT INTO annonces(auteur_id,titre,corps,cible) VALUES(?,?,?,?)').run(admin,'Rentrée scolaire','Bienvenue à tous pour cette nouvelle année scolaire !','tous');
 db.prepare('INSERT INTO devoirs(classe_id,matiere_id,enseignant_id,titre,description,date_remise,bareme,annee_scolaire) VALUES(?,?,?,?,?,?,10,?)').run(cp,m['Mathématiques'],prof,'Exercices de calcul','Page 12, exercices 1 à 4.','2026-12-15T18:00:00.000Z',AN);
 db.prepare('INSERT INTO tarifs(niveau,libelle,montant_millimes,annee_scolaire) VALUES(?,?,?,?)').run('1re année','Inscription',100000,AN);db.prepare('INSERT INTO tarifs(niveau,libelle,montant_millimes,annee_scolaire) VALUES(?,?,?,?)').run('1re année','Scolarité - 1re tranche',400000,AN);
 db.prepare('INSERT INTO affectations(enseignant_id,matiere_id,classe_id,annee_scolaire) VALUES(?,?,?,?)').run(prof2,m['Éveil scientifique'],cp,AN);
 db.prepare('INSERT INTO absences(eleve_id,date,motif,annee_scolaire) VALUES(?,?,?,?)').run(e2,'2026-10-20','Maladie',AN);
})();
console.log('Données de démonstration créées. Comptes (mot de passe : '+PW+') : admin@ecole.demo, prof@ecole.demo, parent@ecole.demo, eleve@ecole.demo, compta@ecole.demo');
