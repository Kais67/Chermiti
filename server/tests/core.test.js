const test=require('node:test'),assert=require('node:assert'),bcrypt=require('bcryptjs');
process.env.JWT_SECRET='test';const{open}=require('../src/db'),db=open(':memory:'),app=require('../src/app')(db);
let srv,base;const h=bcrypt.hashSync('pw',4);
const u=(e,r)=>db.prepare('INSERT INTO users(email,password_hash,nom,role) VALUES(?,?,?,?)').run(e,h,e,r).lastInsertRowid;
const call=async(m,p,t,b)=>{const r=await fetch(base+p,{method:m,headers:{'content-type':'application/json',...(t&&{authorization:'Bearer '+t})},body:b&&JSON.stringify(b)});return{s:r.status,j:await r.json()}};
const login=async e=>(await call('POST','/api/auth/login',null,{email:e,password:'pw'})).j.token;
test.before(()=>new Promise(r=>{srv=app.listen(0,()=>{base='http://127.0.0.1:'+srv.address().port;r()})}));
test.after(()=>srv.close());
test('rôles, notes pondérées, paiement, immuabilité',async()=>{
 u('a@t.tn','admin');const pa=u('p1@t.tn','parent'),pb=u('p2@t.tn','parent');u('c@t.tn','comptable');
 db.prepare("INSERT INTO classes(niveau,capacite,annee_scolaire) VALUES('CP',1,'2026-2027')").run();
 const ta=await login('a@t.tn'),tp1=await login('p1@t.tn'),tp2=await login('p2@t.tn'),tc=await login('c@t.tn');
 const e1=(await call('POST','/api/eleves',ta,{nom:'N',prenom:'A',date_naissance:'2019-01-01',classe_id:1,annee_entree:'2026',annee_scolaire:'2026-2027'})).j.id;
 assert.equal((await call('POST','/api/eleves',ta,{nom:'N',prenom:'B',date_naissance:'2019-01-01',classe_id:1,annee_entree:'2026',annee_scolaire:'2026-2027'})).s,409,'capacité');
 assert.equal((await call('POST','/api/eleves',ta,{nom:''})).s,400,'validation');
 db.prepare('INSERT INTO parent_eleve VALUES(?,?)').run(pa,e1);
 assert.equal((await call('GET','/api/eleves',tp1)).j.length,1);assert.equal((await call('GET','/api/eleves',tp2)).j.length,0);
 assert.equal((await call('GET','/api/eleves/'+e1+'/moyennes/1',tp2)).s,403,'parent B interdit');
 assert.equal((await call('GET','/api/eleves')).s,401);
 db.prepare("INSERT INTO matieres(nom,coefficient,niveau) VALUES('Maths',3,'CP'),('Arabe',1,'CP')").run();
 db.prepare("INSERT INTO evaluations(classe_id,matiere_id,titre,trimestre,annee_scolaire) VALUES(1,1,'DS',1,'2026-2027'),(1,2,'DS',1,'2026-2027')").run();
 db.prepare("INSERT INTO notes(evaluation_id,eleve_id,valeur,annee_scolaire) VALUES(1,?,16,'x'),(2,?,8,'x')").run(e1,e1);
 assert.equal((await call('GET','/api/eleves/'+e1+'/moyennes/1',tp1)).j.generale,14); // (16*3+8)/4
 db.prepare("INSERT INTO frais(eleve_id,libelle,montant_millimes,annee_scolaire) VALUES(?,'Scolarité',500000,'2026-2027')").run(e1);
 assert.equal((await call('POST','/api/paiements',tp1,{eleveId:e1,montant:1,mode:'especes',annee:'2026-2027'})).s,403);
 const p=await call('POST','/api/paiements',tc,{eleveId:e1,montant:200000,mode:'especes',annee:'2026-2027'});
 assert.equal(p.j.solde,300000);assert.equal((await call('GET','/api/messages',tp1)).j.length,1,'message auto au parent');
 assert.throws(()=>db.prepare('UPDATE messages SET corps=? WHERE id=1').run('x'),/immuable/);
 assert.throws(()=>db.prepare('DELETE FROM messages WHERE id=1').run(),/non supprimable/);
 assert.equal((await call('DELETE','/api/eleves/'+e1,tc)).s,403);assert.equal((await call('DELETE','/api/eleves/'+e1,ta)).s,200);
});
test('migrations rejouables',()=>{const{migrate}=require('../src/db');migrate(db);assert.equal(db.prepare("SELECT COUNT(*) n FROM schema_migrations").get().n,6)});
test('modules : conflits, annonces, messagerie, devoirs, validation',async()=>{
 const ad=u('a2@t.tn','admin'),te=u('t1@t.tn','enseignant'),t2=u('t2@t.tn','enseignant'),pr=u('pp@t.tn','parent'),el=u('ee@t.tn','eleve');
 const ta=await login('a2@t.tn'),tt=await login('t1@t.tn'),tpp=await login('pp@t.tn'),tel=await login('ee@t.tn');
 const cl=(await call('POST','/api/classes',ta,{niveau:'CE1',section:'B',capacite:20,annee_scolaire:'2026-2027'})).j.id;
 const mt=(await call('POST','/api/matieres',ta,{nom:'Maths2',coefficient:2,niveau:'Tous'})).j.id;
 const sa=(await call('POST','/api/salles',ta,{nom:'S9',capacite:20,disponible:1})).j.id;
 const cr={classe_id:cl,matiere_id:mt,enseignant_id:te,salle_id:sa,jour:1,debut:'08:00',fin:'09:00',annee_scolaire:'2026-2027'};
 assert.equal((await call('POST','/api/creneaux',ta,cr)).s,201);
 assert.equal((await call('POST','/api/creneaux',ta,{...cr,classe_id:1})).s,409,'conflit enseignant/salle');
 assert.equal((await call('POST','/api/creneaux',tt,cr)).s,403);
 const e=db.prepare("INSERT INTO eleves(nom,prenom,date_naissance,classe_id,user_id,annee_entree,annee_scolaire) VALUES('X','Y','2019-01-01',?,?, '2026','2026-2027')").run(cl,el).lastInsertRowid;
 db.prepare('INSERT INTO parent_eleve VALUES(?,?)').run(pr,e);
 assert.equal((await call('DELETE','/api/classes/'+cl,ta)).s,409,'classe non vide');
 assert.equal((await call('POST','/api/annonces',ta,{titre:'T',corps:'C',cible:'parents'})).s,201);
 assert.equal((await call('POST','/api/annonces',tt,{titre:'T',corps:'C',cible:'tous'})).s,403);
 assert.throws(()=>db.prepare('UPDATE annonces SET titre=?').run('z'),/immuable/);
 assert.equal((await call('GET','/api/annonces',tel)).j.length,0,'ciblage par rôle');
 assert.equal((await call('POST','/api/messages',tt,{destinataire_id:pr,objet:'Bonjour',corps:'x'})).s,201,'enseignant → parent de ses élèves');
 assert.equal((await call('POST','/api/messages',tt,{destinataire_id:ad,objet:'a',corps:'x'})).s,201);
 assert.equal((await call('POST','/api/messages',tel,{destinataire_id:pr,objet:'a',corps:'x'})).s,403,'élève → parent interdit');
 const t2tok=await login('t2@t.tn');assert.equal((await call('POST','/api/messages',t2tok,{destinataire_id:pr,objet:'a',corps:'x'})).s,403,'enseignant non lié');
 const bd=(await call('POST','/api/messages',tpp,{destinataire_id:te,objet:'Brouillon',corps:'x',brouillon:true})).j.id;
 assert.equal((await call('PUT','/api/messages/'+bd,tpp,{corps:'modifié'})).s,200);assert.equal((await call('PUT','/api/messages/'+bd,tpp,{envoyer:true})).s,200);
 assert.equal((await call('PUT','/api/messages/'+bd,tpp,{corps:'trop tard'})).s,409,'immuable après envoi');assert.equal((await call('DELETE','/api/messages/'+bd,tpp)).s,409);
 assert.ok((await call('GET','/api/notifications',tpp)).j.length>=1,'notification');
 const dv=(await call('POST','/api/devoirs',ta,{classe_id:cl,matiere_id:mt,titre:'D1',date_remise:'2099-01-01T00:00:00Z',bareme:10})).j.id;
 assert.equal((await call('GET','/api/devoirs',tel)).j.length,1);assert.equal((await call('GET','/api/devoirs',tpp)).j.length,1);
 assert.equal((await call('DELETE','/api/devoirs/'+dv,tel)).s,403);
 assert.equal((await call('POST','/api/public/preinscriptions',null,{nom:'a',prenom:'b',date_naissance:'2020-01-01',parent_nom:'p',parent_email:'x@y.tn',consentement:false})).s,400,'consentement obligatoire');
 assert.equal((await call('POST','/api/notes',tt,{evaluation_id:1,eleve_id:e,valeur:5})).s,403,'enseignant non affecté');
});
test('corrections : édition, capacité, âge, tarifs, paiement modifié, affectation, pièces jointes, dépôts multiples',async()=>{
 u('a3@t.tn','admin');const co=u('c3@t.tn','comptable'),te=u('t3@t.tn','enseignant'),t4=u('t4@t.tn','enseignant'),pr=u('p3@t.tn','parent'),el=u('e3@t.tn','eleve');
 const ta=await login('a3@t.tn'),tc=await login('c3@t.tn'),tt=await login('t3@t.tn'),t4t=await login('t4@t.tn'),tpr=await login('p3@t.tn'),tel=await login('e3@t.tn');
 // modifier un utilisateur
 assert.equal((await call('PUT','/api/utilisateurs/'+te,ta,{nom:'Nouveau Nom',telephone:'20123456'})).s,200);
 assert.equal((await call('GET','/api/utilisateurs?role=enseignant',ta)).j.find(x=>x.id===te).nom,'Nouveau Nom');
 assert.equal((await call('PUT','/api/utilisateurs/'+te,tc,{nom:'x'})).s,403);
 assert.equal((await call('PUT','/api/utilisateurs/'+te,ta,{password:'court'})).s,400,'mot de passe trop court');
 // capacité à la modification + affectation automatique par âge
 const c1=(await call('POST','/api/classes',ta,{niveau:'2e année',section:'Z',capacite:1,titulaire_id:te,annee_scolaire:'2026-2027'})).j.id;
 const mk=async(p,d)=>(await call('POST','/api/eleves',ta,{nom:'N',prenom:p,date_naissance:d,annee_entree:'2026',annee_scolaire:'2026-2027',...(p==='A'?{classe_id:c1}:{})})).j.id;
 const e1=await mk('A','2019-05-05'),e2=await mk('B','2019-05-05'),e3=await mk('C','2012-01-01');
 assert.equal((await call('PUT','/api/eleves/'+e2,ta,{classe_id:c1})).s,409,'classe complète à la modification');
 assert.equal((await call('POST',`/api/eleves/${e2}/affecter-auto`,ta)).s,409,'aucune place en 2e année');
 const cy=(await call('POST','/api/classes',ta,{niveau:'2e année',section:'Y',capacite:5,annee_scolaire:'2026-2027'})).j.id;
 const aa=await call('POST',`/api/eleves/${e2}/affecter-auto`,ta);assert.equal(aa.j.classe_id,cy);assert.equal(aa.j.age,7);
 assert.equal((await call('POST',`/api/eleves/${e3}/affecter-auto`,ta)).s,400,'âge hors primaire');
 // tarifs, paiement, modification, lien du reçu, journal d'envoi
 db.prepare('INSERT INTO parent_eleve VALUES(?,?)').run(pr,e1);
 assert.equal((await call('POST','/api/tarifs',tc,{niveau:'2e année',libelle:'Inscription',montant_millimes:100000,annee_scolaire:'2026-2027'})).s,201);
 assert.equal((await call('POST','/api/tarifs/appliquer',tc)).j.frais_crees,2);assert.equal((await call('POST','/api/tarifs/appliquer',tc)).j.frais_crees,0,'idempotent');
 const pa=(await call('POST','/api/paiements',tc,{eleveId:e1,montant:40000,mode:'especes',annee:'2026-2027'})).j;assert.equal(pa.solde,60000);
 const mod=await call('PUT','/api/paiements/'+pa.id,tc,{montant_millimes:50000});assert.equal(mod.j.solde,50000);
 assert.equal(db.prepare('SELECT solde_apres_millimes s FROM paiements WHERE id=?').get(pa.id).s,50000,'solde après recalculé');
 assert.ok((await call('GET','/api/messages',tpr)).j[0].corps.includes('/paiements?recu='+pa.id),'lien du reçu');
 assert.equal(db.prepare("SELECT COUNT(*) n FROM journal_envois WHERE type='paiement' AND reference=? AND canal='messagerie' AND statut='envoye'").get(pa.id).n,1);
 assert.equal((await call('PUT','/api/paiements/'+pa.id,tpr,{montant_millimes:1})).s,403);
 // type d'évaluation + affectation
 const mt=(await call('POST','/api/matieres',ta,{nom:'Dessin',coefficient:1,niveau:'2e année'})).j.id;
 const ev=(await call('POST','/api/evaluations',ta,{classe_id:c1,matiere_id:mt,titre:'Exam',trimestre:1,type:'examen',bareme:20,annee_scolaire:'2026-2027'}));assert.equal(ev.s,201);
 assert.equal((await call('POST','/api/evaluations',ta,{classe_id:c1,matiere_id:mt,titre:'X',trimestre:1,type:'autre',bareme:20,annee_scolaire:'2026-2027'})).s,400);
 assert.equal((await call('POST','/api/notes',t4t,{evaluation_id:ev.j.id,eleve_id:e1,valeur:12})).s,403,'non affecté');
 assert.equal((await call('POST','/api/affectations',ta,{enseignant_id:t4,matiere_id:mt,classe_id:c1,annee_scolaire:'2026-2027'})).s,201);
 assert.equal((await call('POST','/api/notes',t4t,{evaluation_id:ev.j.id,eleve_id:e1,valeur:12})).s,200,'affecté');
 assert.equal((await call('DELETE','/api/utilisateurs/'+t4,ta)).s,409,'enseignant affecté non supprimable');
 // pièce jointe de message
 const fd=new FormData();fd.append('destinataire_id',te);fd.append('objet','PJ');fd.append('corps','x');fd.append('brouillon','false');fd.append('fichier',new Blob(['hello']),'a.txt');
 assert.equal((await fetch(base+'/api/messages',{method:'POST',headers:{authorization:'Bearer '+tpr},body:fd})).status,201);
 const m=(await call('GET','/api/messages',tt)).j[0];assert.equal(m.piece_nom,'a.txt');
 assert.equal(await (await fetch(base+'/api/messages/'+m.id+'/piece',{headers:{authorization:'Bearer '+tt}})).text(),'hello');
 const bad=new FormData();bad.append('destinataire_id',te);bad.append('objet','x');bad.append('corps','x');bad.append('fichier',new Blob(['x']),'virus.exe');
 assert.equal((await fetch(base+'/api/messages',{method:'POST',headers:{authorization:'Bearer '+tpr},body:bad})).status,400,'type refusé');
 // dépôt multi-fichiers et remplacement
 db.prepare('UPDATE eleves SET user_id=? WHERE id=?').run(el,e1);
 const dv=(await call('POST','/api/devoirs',ta,{classe_id:c1,matiere_id:mt,titre:'D',date_remise:'2099-01-01T00:00:00Z'})).j.id;
 const dep=(n)=>{const f=new FormData();for(let i=0;i<n;i++)f.append('fichier',new Blob(['f'+i]),`f${i}.txt`);return fetch(base+`/api/devoirs/${dv}/depot`,{method:'POST',headers:{authorization:'Bearer '+tel},body:f})};
 assert.equal((await dep(2)).status,201);
 let l=(await call('GET',`/api/devoirs/${dv}/depots`,ta)).j.find(x=>x.eleve_id===e1);assert.equal(l.fichiers.length,2);
 const f2=await fetch(base+`/api/depots/${l.depot_id}/fichier?f=${l.fichiers[1].id}`,{headers:{authorization:'Bearer '+tel}});assert.equal(await f2.text(),'f1');
 assert.equal((await dep(1)).status,201);l=(await call('GET',`/api/devoirs/${dv}/depots`,ta)).j.find(x=>x.eleve_id===e1);assert.equal(l.fichiers.length,1,'remplacement');
});
test('audit : périmètre enseignant, solde, années, salle, mot de passe, fil, validation',async()=>{
 u('a5@t.tn','admin');const te=u('t5@t.tn','enseignant'),tx=u('t6@t.tn','enseignant'),pr=u('p5@t.tn','parent'),pq=u('p6@t.tn','parent'),co=u('c5@t.tn','comptable');
 const ta=await login('a5@t.tn'),tt=await login('t5@t.tn'),tpr=await login('p5@t.tn'),tpq=await login('p6@t.tn'),tc=await login('c5@t.tn');
 const cA=(await call('POST','/api/classes',ta,{niveau:'N5',section:'A',capacite:20,titulaire_id:te,annee_scolaire:'2026-2027'})).j.id;
 const cB=(await call('POST','/api/classes',ta,{niveau:'N6',section:'A',capacite:20,titulaire_id:tx,annee_scolaire:'2026-2027'})).j.id;
 const mk=async(p,c)=>(await call('POST','/api/eleves',ta,{nom:'Z',prenom:p,date_naissance:'2019-01-01',classe_id:c,annee_entree:'2026',annee_scolaire:'2026-2027',antecedents_medicaux:'Asthme'})).j.id;
 const sA=await mk('A5',cA),sB=await mk('B5',cB);db.prepare('INSERT INTO parent_eleve VALUES(?,?)').run(pr,sA);db.prepare('INSERT INTO parent_eleve VALUES(?,?)').run(pq,sB);
 const mt=(await call('POST','/api/matieres',ta,{nom:'Audit',coefficient:2,niveau:'Tous'})).j.id;
 // périmètre enseignant
 const ids=(await call('GET','/api/eleves',tt)).j.map(x=>x.id);assert.ok(ids.includes(sA)&&!ids.includes(sB),'enseignant : seulement ses classes');
 assert.ok((await call('GET','/api/eleves',tc)).j.every(x=>x.antecedents_medicaux===undefined),'comptable : pas de données médicales');
 assert.equal((await call('POST','/api/evaluations',tt,{classe_id:cB,matiere_id:mt,titre:'X',trimestre:1,bareme:20,annee_scolaire:'2026-2027'})).s,403,'évaluation hors périmètre');
 const evA=(await call('POST','/api/evaluations',tt,{classe_id:cA,matiere_id:mt,titre:'A',trimestre:1,bareme:20,annee_scolaire:'2026-2027'}));assert.equal(evA.s,201);
 const evB=(await call('POST','/api/evaluations',ta,{classe_id:cB,matiere_id:mt,titre:'B',trimestre:1,bareme:20,annee_scolaire:'2026-2027'})).j.id;await call('POST','/api/notes',ta,{evaluation_id:evB,eleve_id:sB,valeur:10});
 assert.equal((await call('GET','/api/notes?evaluation_id='+evB,tt)).s,403,'lecture des notes hors périmètre');
 const nB=(await call('GET','/api/notes?evaluation_id='+evB,ta)).j[0].id;assert.equal((await call('DELETE','/api/notes/'+nB,tt)).s,403,'suppression de note hors périmètre');
 assert.equal((await call('POST','/api/absences',tt,{eleve_id:sB,date:new Date(Date.now()-864e5).toISOString().slice(0,10)})).s,403,'absence hors classe');assert.equal((await call('POST','/api/absences',tt,{eleve_id:sA,date:new Date(Date.now()-864e5).toISOString().slice(0,10)})).s,201);
 assert.equal((await call('GET','/api/eleves/'+sB+'/moyennes/1',tt)).s,403,'moyennes hors périmètre');
 // solde : pas de sur-paiement
 await call('POST','/api/frais',ta,{eleve_id:sA,libelle:'Scolarité',montant_millimes:100000,annee_scolaire:'2026-2027'});
 assert.equal((await call('POST','/api/paiements',tc,{eleveId:sA,montant:200000,mode:'especes',annee:'2026-2027'})).s,409,'sur-paiement refusé');
 const pp=await call('POST','/api/paiements',tc,{eleveId:sA,montant:100000,mode:'especes',annee:'2026-2027'});assert.equal(pp.j.solde,0);
 assert.equal((await call('POST','/api/paiements',tc,{eleveId:sA,montant:1000,mode:'especes',annee:'2026-2027'})).s,409,'plus rien à payer');
 assert.equal((await call('PUT','/api/paiements/'+pp.j.id,tc,{montant_millimes:150000})).s,409,'modification au-delà du dû refusée');
 // années : les anciennes notes ne polluent pas la moyenne
 await call('POST','/api/notes',tt,{evaluation_id:evA.j.id,eleve_id:sA,valeur:16});
 const old=db.prepare("INSERT INTO evaluations(classe_id,matiere_id,titre,trimestre,bareme,annee_scolaire) VALUES(?,?,'Ancienne',1,20,'2025-2026')").run(cA,mt).lastInsertRowid;db.prepare("INSERT INTO notes(evaluation_id,eleve_id,valeur,annee_scolaire) VALUES(?,?,2,'2025-2026')").run(old,sA);
 assert.equal((await call('GET','/api/eleves/'+sA+'/moyennes/1',tpr)).j.generale,16,'année courante seule');
 assert.equal((await call('GET','/api/eleves/'+sA+'/moyennes/1?annee=2025-2026',tpr)).j.generale,2,'historique par année');
 // salle indisponible
 const sl=(await call('POST','/api/salles',ta,{nom:'Salle HS',capacite:10,disponible:0})).j.id;
 assert.equal((await call('POST','/api/creneaux',ta,{classe_id:cA,matiere_id:mt,enseignant_id:te,salle_id:sl,jour:4,debut:'08:00',fin:'09:00',annee_scolaire:'2026-2027'})).s,409,'salle indisponible');
 // fil de discussion par élève
 const m1=(await call('POST','/api/messages',tt,{destinataire_id:pr,objet:'Suivi',corps:'Bonjour',eleve_id:sA})).j.id;
 const m2=await call('POST','/api/messages',tpr,{destinataire_id:te,objet:'Re: Suivi',corps:'Merci',eleve_id:sA,reponse_a:m1});assert.equal(m2.s,201);
 assert.equal((await call('GET','/api/messages/'+m1+'/fil',tpr)).j.length,2,'fil à deux messages');assert.equal((await call('GET','/api/messages/'+m1+'/fil',tpq)).s,404,'fil privé');
 assert.equal((await call('POST','/api/messages',tt,{destinataire_id:pr,objet:'x',corps:'x',eleve_id:sB})).s,400,'élève non rattaché à ce parent');
 // mot de passe, e-mail insensible à la casse, validation en français, fichier volumineux
 assert.equal((await call('POST','/api/auth/login',null,{email:'P5@T.TN',password:'pw'})).s,200,'e-mail insensible à la casse');
 assert.equal((await call('PUT','/api/auth/mot-de-passe',tpr,{ancien:'faux',nouveau:'NouveauMdp1'})).s,400);assert.equal((await call('PUT','/api/auth/mot-de-passe',tpr,{ancien:'pw',nouveau:'court'})).s,400);
 assert.equal((await call('PUT','/api/auth/mot-de-passe',tpr,{ancien:'pw',nouveau:'NouveauMdp1'})).s,200);
 assert.equal((await call('POST','/api/auth/login',null,{email:'p5@t.tn',password:'pw'})).s,401);assert.equal((await call('POST','/api/auth/login',null,{email:'p5@t.tn',password:'NouveauMdp1'})).s,200);
 const v=await call('POST','/api/auth/login',null,{email:'x',password:''});assert.ok(v.j.details.every(d=>!/\\b(invalid|expected|required)\\b/i.test(d.message)),'validation en français : '+v.j.details.map(d=>d.message).join(' | '));
 const big=new FormData();big.append('destinataire_id',te);big.append('objet','x');big.append('corps','x');big.append('fichier',new Blob([Buffer.alloc(11*1024*1024,1)]),'gros.pdf');
 const bigR=await fetch(base+'/api/messages',{method:'POST',headers:{authorization:'Bearer '+tpr},body:big});assert.equal(bigR.status,400,'fichier trop gros → 400');
 // anti-spam pré-inscription
 const sts=[];for(let i=0;i<14;i++)sts.push((await call('POST','/api/public/preinscriptions',null,{nom:'S',prenom:'x',date_naissance:'2020-01-01',parent_nom:'p',parent_email:'s@s.tn',consentement:true})).s);assert.ok(sts.includes(429)&&sts[0]===201,'limite anti-spam : '+sts.join(','));
 // relances : manuelle, puis automatique sans doublon
 const rel=require('../src/services/relances');await call('POST','/api/frais',ta,{eleve_id:sB,libelle:'Scolarité',montant_millimes:50000,annee_scolaire:'2026-2027'});
 const n1=rel.lancer(db,{jours:7});assert.ok(n1>=1,'première relance auto');assert.equal(rel.lancer(db,{jours:7}),0,'pas de doublon dans les 7 jours');assert.ok(rel.lancer(db,{force:true})>=1,'relance manuelle forcée');
 // années : création + activation + moyennes de l'année active
 const an=await call('POST','/api/annees',ta,{libelle:'2027-2028'});assert.equal(an.s,201);assert.equal((await call('PUT','/api/annees/'+an.j.id+'/activer',ta)).s,200);
 assert.equal((await call('GET','/api/eleves/'+sA+'/moyennes/1',tpr)).j.generale,null,'nouvelle année active : aucune note');
});
test('pré-inscription validée → compte parent, mot de passe temporaire, réinitialisation',async()=>{
 u('a7@t.tn','admin');const ta=await login('a7@t.tn');
 const ins=(email)=>db.prepare("INSERT INTO preinscriptions(nom,prenom,date_naissance,parent_nom,parent_email,consentement) VALUES('Kais','Enfant','2020-02-02','Parent K',?,1)").run(email).lastInsertRowid;
 const p1=ins('Nouveau.Parent@Mail.TN');
 const v=await call('PUT',`/api/preinscriptions/${p1}/statut`,ta,{statut:'validee'});assert.equal(v.s,200);
 assert.ok(v.j.compte.cree&&v.j.compte.mdp.length>=10&&v.j.compte.email==='nouveau.parent@mail.tn','compte créé, e-mail normalisé');
 const lg=await call('POST','/api/auth/login',null,{email:'nouveau.parent@mail.tn',password:v.j.compte.mdp});assert.equal(lg.s,200,'connexion avec le mot de passe temporaire');assert.equal(lg.j.user.mdp_temporaire,true);assert.equal(lg.j.user.role,'parent');
 const kids=(await call('GET','/api/eleves',lg.j.token)).j;assert.equal(kids.length,1,'enfant rattaché au parent');assert.equal(kids[0].prenom,'Enfant');
 assert.ok(!db.prepare("SELECT password_hash h FROM users WHERE email='nouveau.parent@mail.tn'").get().h.includes(v.j.compte.mdp),'mot de passe jamais stocké en clair');
 assert.equal((await call('PUT','/api/auth/mot-de-passe',lg.j.token,{ancien:v.j.compte.mdp,nouveau:'MonNouveauMdp9'})).s,200);assert.equal((await call('GET','/api/auth/moi',lg.j.token)).j.mdp_temporaire,0,'plus temporaire après changement');
 const p2=ins('nouveau.parent@mail.tn');const v2=await call('PUT',`/api/preinscriptions/${p2}/statut`,ta,{statut:'validee'});assert.equal(v2.j.compte.cree,false);assert.equal(v2.j.compte.mdp,null);assert.equal((await call('GET','/api/eleves',lg.j.token)).j.length,2,'deuxième enfant, même compte');
 const p3=ins('a7@t.tn');const nEl=db.prepare('SELECT COUNT(*) n FROM eleves').get().n;assert.equal((await call('PUT',`/api/preinscriptions/${p3}/statut`,ta,{statut:'validee'})).s,409,'e-mail d\'un compte non parent');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM eleves').get().n,nEl,'transaction annulée');assert.equal(db.prepare('SELECT statut s FROM preinscriptions WHERE id=?').get(p3).s,'en_attente');
 const p4=db.prepare("INSERT INTO preinscriptions(nom,prenom,date_naissance,parent_nom,parent_email,consentement,statut) VALUES('Ancien','Cas','2019-03-03','Parent A','ancien@mail.tn',1,'validee')").run().lastInsertRowid;
 db.prepare("INSERT INTO eleves(nom,prenom,date_naissance,annee_entree,annee_scolaire) VALUES('Ancien','Cas','2019-03-03','2026','2026-2027')").run();
 const c4=await call('POST',`/api/preinscriptions/${p4}/compte`,ta);assert.equal(c4.s,200,'compte créé après coup pour une ancienne validation');assert.ok(c4.j.compte.cree);
 assert.equal((await call('POST','/api/auth/login',null,{email:'ancien@mail.tn',password:c4.j.compte.mdp})).s,200);
 const uid=db.prepare("SELECT id FROM users WHERE email='ancien@mail.tn'").get().id;const rz=await call('POST',`/api/utilisateurs/${uid}/reinitialiser`,ta);assert.equal(rz.s,200);
 assert.equal((await call('POST','/api/auth/login',null,{email:'ancien@mail.tn',password:c4.j.compte.mdp})).s,401,'ancien mot de passe invalidé');assert.equal((await call('POST','/api/auth/login',null,{email:'ancien@mail.tn',password:rz.j.mdp})).s,200);
 const tp=(await call('POST','/api/auth/login',null,{email:'nouveau.parent@mail.tn',password:'MonNouveauMdp9'})).j.token;assert.equal((await call('POST',`/api/utilisateurs/${uid}/reinitialiser`,tp)).s,403,'réservé à l\'administrateur');
 assert.equal((await call('POST','/api/email-test',ta,{to:'x@y.tn'})).j.statut,'non_configure','e-mail non configuré : message clair');
});
test('e-mail : requête vers l\'API Brevo vérifiée sur un faux serveur',async()=>{
 const http=require('http');let got;const fake=http.createServer((rq,rs)=>{let b='';rq.on('data',c=>b+=c);rq.on('end',()=>{got={h:rq.headers,b:JSON.parse(b)};rs.writeHead(rq.headers['api-key']==='bonne-cle'?201:401,{'content-type':'application/json'});rs.end('{"message":"x"}')})});
 await new Promise(r=>fake.listen(0,r));process.env.BREVO_API_URL=`http://127.0.0.1:${fake.address().port}/v3/smtp/email`;process.env.MAIL_FROM='ecole@exemple.tn';
 const m=require('../src/services/mailer');process.env.BREVO_API_KEY='bonne-cle';assert.ok(m.actif());
 const r=await m.envoyer('parent@exemple.tn','Sujet','Corps du message');assert.equal(r.statut,'envoye');assert.equal(got.h['api-key'],'bonne-cle');assert.equal(got.b.to[0].email,'parent@exemple.tn');assert.equal(got.b.sender.email,'ecole@exemple.tn');assert.equal(got.b.subject,'Sujet');assert.equal(got.b.textContent,'Corps du message');
 process.env.BREVO_API_KEY='mauvaise';const r2=await m.envoyer('parent@exemple.tn','S','C');assert.equal(r2.statut,'echec');assert.match(r2.detail,/401/,'échec signalé avec le détail');
 fake.close();delete process.env.BREVO_API_KEY;delete process.env.BREVO_API_URL;delete process.env.MAIL_FROM;
});

const AN=()=>(db.prepare('SELECT libelle FROM annees_scolaires WHERE active=1').get()||{}).libelle||'2026-2027';
test('logique métier : cohérences refusées',async()=>{
 const ad=u('a8@t.tn','admin'),te=u('t8@t.tn','enseignant');const ta=await login('a8@t.tn');const an=AN();
 const mkClasse=(n,s,cap,tit)=>call('POST','/api/classes',ta,{niveau:n,section:s,capacite:cap,titulaire_id:tit,annee_scolaire:an});
 assert.equal((await mkClasse('3e année','X',5,ad)).s,400,'titulaire non enseignant');assert.equal((await mkClasse('3e année','X',60,te)).s,400,'capacité excessive');
 assert.equal((await call('POST','/api/classes',ta,{niveau:'3e année',section:'X',capacite:5,annee_scolaire:'2031-2032'})).s,400,'année inexistante');
 const cA=(await mkClasse('3e année','L',5,te)).j.id,cB=(await mkClasse('4e année','L',5,te)).j.id;
 const stu=async(p,c,d='2018-06-01')=>(await call('POST','/api/eleves',ta,{nom:'L',prenom:p,date_naissance:d,classe_id:c,annee_entree:'2026',annee_scolaire:an})).j.id;
 const s1=await stu('S1',cA),s2=await stu('S2',cA),s3=await stu('S3',cA),sB=await stu('SB',cB);
 assert.equal((await call('POST','/api/eleves',ta,{nom:'L',prenom:'Futur',date_naissance:'2999-01-01',annee_entree:'2026',annee_scolaire:an})).s,400,'naissance dans le futur');
 assert.equal((await call('PUT','/api/classes/'+cA,ta,{capacite:2})).s,409,'capacité < effectif');
 const m1=(await call('POST','/api/matieres',ta,{nom:'Niv1',coefficient:1,niveau:'1re année'})).j.id,mT=(await call('POST','/api/matieres',ta,{nom:'ToutNiv',coefficient:1,niveau:'Tous'})).j.id;
 const ev=(m,c,a=an)=>call('POST','/api/evaluations',ta,{classe_id:c,matiere_id:m,titre:'E',trimestre:1,bareme:20,annee_scolaire:a});
 assert.equal((await ev(m1,cA)).s,409,"matière d'un autre niveau");const e1=await ev(mT,cA);assert.equal(e1.s,201);assert.equal((await ev(mT,cA,'2020-2021')).s,409,'année ≠ classe');
 assert.equal((await call('POST','/api/notes',ta,{evaluation_id:e1.j.id,eleve_id:sB,valeur:10})).s,409,"élève hors de la classe de l'évaluation");assert.equal((await call('POST','/api/notes',ta,{evaluation_id:e1.j.id,eleve_id:s1,valeur:10})).s,200);
 const sl=(await call('POST','/api/salles',ta,{nom:'Salle L',capacite:30,disponible:1})).j.id,slp=(await call('POST','/api/salles',ta,{nom:'Salle Petite',capacite:2,disponible:1})).j.id;
 const cr=o=>call('POST','/api/creneaux',ta,{classe_id:cA,matiere_id:mT,enseignant_id:te,salle_id:sl,jour:2,debut:'08:00',fin:'09:00',annee_scolaire:an,...o});
 assert.equal((await cr({debut:'06:00',fin:'07:00'})).s,400,'hors horaires');assert.equal((await cr({debut:'08:00',fin:'12:00'})).s,400,'plus de 3 heures');assert.equal((await cr({enseignant_id:ad})).s,400,'intervenant non enseignant');
 assert.equal((await cr({salle_id:slp})).s,409,'salle trop petite');assert.equal((await cr({annee_scolaire:'2020-2021'})).s,409,'année ≠ classe');
 assert.equal((await cr({})).s,201);assert.ok(db.prepare('SELECT 1 FROM affectations WHERE enseignant_id=? AND matiere_id=? AND classe_id=?').get(te,mT,cA),'affectation créée automatiquement');
 assert.equal((await call('DELETE','/api/classes/'+cA,ta)).s,409,'classe référencée');
 assert.equal((await call('POST','/api/devoirs',ta,{classe_id:cA,matiere_id:mT,titre:'Passé',date_remise:'2020-01-01T00:00:00Z'})).s,400,'remise dans le passé');
 const hier=new Date(Date.now()-864e5).toISOString().slice(0,10),demain=new Date(Date.now()+864e5).toISOString().slice(0,10);
 assert.equal((await call('POST','/api/absences',ta,{eleve_id:s1,date:demain})).s,400,'absence future');assert.equal((await call('POST','/api/absences',ta,{eleve_id:s1,date:hier})).s,201);assert.equal((await call('POST','/api/absences',ta,{eleve_id:s1,date:hier})).s,409,'doublon');
 const f=(await call('POST','/api/frais',ta,{eleve_id:s1,libelle:'Scolarité',montant_millimes:100000,annee_scolaire:an})).j.id;u('c8@t.tn','comptable');const tc=await login('c8@t.tn');
 assert.equal((await call('POST','/api/paiements',tc,{eleveId:s1,montant:60000,mode:'especes',annee:an})).s,201);
 assert.equal((await call('PUT','/api/frais/'+f,ta,{montant_millimes:50000})).s,409,'frais < paiements');assert.equal((await call('DELETE','/api/frais/'+f,ta)).s,409,'frais payés non supprimables');assert.equal((await call('PUT','/api/frais/'+f,ta,{montant_millimes:70000})).s,200);
 const pr=u('p8@t.tn','parent');assert.equal((await call('POST','/api/parent-eleve',ta,{parent_id:te,eleve_id:s1})).s,400,'lien avec un non-parent');assert.equal((await call('POST','/api/parent-eleve',ta,{parent_id:pr,eleve_id:s1})).s,201);
 assert.equal((await call('PUT','/api/eleves/'+s1+'/compte',ta,{user_id:te})).s,400,'compte élève : mauvais rôle');assert.equal((await call('POST','/api/annees',ta,{libelle:'2040-2050'})).s,400,'années non consécutives');
});
test('pré-inscription publique : doublon et date de naissance (instance isolée)',async()=>{
 const{open}=require('../src/db'),db2=open(':memory:'),app2=require('../src/app')(db2);const s2=await new Promise(r=>{const s=app2.listen(0,()=>r(s))});
 const c2=async(b)=>{const r=await fetch('http://127.0.0.1:'+s2.address().port+'/api/public/preinscriptions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});return r.status};
 const pi={nom:'Petit',prenom:'Enfant',date_naissance:'2020-05-05',parent_nom:'P',parent_email:'p@x.tn',consentement:true};
 assert.equal(await c2(pi),201);assert.equal(await c2(pi),409,'doublon en attente');assert.equal(await c2({...pi,prenom:'Futur',date_naissance:'2999-01-01'}),400,'naissance dans le futur');s2.close();
});
test('étoiles de félicitations et thèmes des matières',async()=>{
 u('a9@t.tn','admin');const te=u('t9@t.tn','enseignant'),tx=u('t10@t.tn','enseignant'),pr=u('p9@t.tn','parent'),el=u('e9@t.tn','eleve');
 const ta=await login('a9@t.tn'),tt=await login('t9@t.tn'),tx2=await login('t10@t.tn'),tpr=await login('p9@t.tn'),tel=await login('e9@t.tn'),an=AN();
 const cA=(await call('POST','/api/classes',ta,{niveau:'5e année',section:'F',capacite:5,titulaire_id:te,annee_scolaire:an})).j.id,cB=(await call('POST','/api/classes',ta,{niveau:'6e année',section:'F',capacite:5,titulaire_id:tx,annee_scolaire:an})).j.id;
 const mk=async(p,c)=>(await call('POST','/api/eleves',ta,{nom:'F',prenom:p,date_naissance:'2016-01-01',classe_id:c,annee_entree:'2026',annee_scolaire:an})).j.id;
 const sA=await mk('FA',cA),sB=await mk('FB',cB);db.prepare('INSERT INTO parent_eleve VALUES(?,?)').run(pr,sA);db.prepare('UPDATE eleves SET user_id=? WHERE id=?').run(el,sA);
 assert.equal((await call('POST','/api/felicitations',tt,{eleve_id:sA,motif:'Très bon travail',icone:'trophee'})).s,201);assert.equal((await call('POST','/api/felicitations',tt,{eleve_id:sB,motif:'Intrus'})).s,403,'élève hors classes');
 assert.equal((await call('POST','/api/felicitations',tpr,{eleve_id:sA,motif:'Moi'})).s,403,'parent ne peut pas');assert.equal((await call('POST','/api/felicitations',tt,{eleve_id:sA,motif:'x'})).s,400,'motif trop court');
 for(const t of[tpr,tel,tt])assert.equal((await call('GET','/api/felicitations',t)).j.length,1);assert.equal((await call('GET','/api/felicitations',tx2)).j.length,0,'autre enseignant : rien');
 assert.ok((await call('GET','/api/notifications',tpr)).j.some(n=>n.texte.includes('Félicitations')),'parent notifié');
 const id=(await call('GET','/api/felicitations',tt)).j[0].id;assert.equal((await call('DELETE','/api/felicitations/'+id,tpr)).s,403);assert.equal((await call('DELETE','/api/felicitations/'+id,tt)).s,200);
 const mat=(await call('POST','/api/matieres',ta,{nom:'Éducation islamique',coefficient:1,niveau:'Tous'})).j.id;
 const l1=(await call('GET','/api/matieres',tpr)).j.find(m=>m.id===mat);assert.equal(l1.icone,'croissant');assert.match(l1.couleur,/^#/);
 assert.equal((await call('PUT','/api/matieres/'+mat,ta,{icone:'inconnue'})).s,400,'icône inconnue');assert.equal((await call('PUT','/api/matieres/'+mat,ta,{icone:'globe',couleur:'#2f6fb5'})).s,200);
 assert.equal((await call('GET','/api/matieres',tpr)).j.find(m=>m.id===mat).icone,'globe','thème personnalisé');
});
test('paiement en ligne (simulation), reçu PDF illustré et vérification',async()=>{
 u('a11@t.tn','admin');const pr=u('p11@t.tn','parent'),pq=u('p12@t.tn','parent');u('c11@t.tn','comptable');
 const ta=await login('a11@t.tn'),tpr=await login('p11@t.tn'),tpq=await login('p12@t.tn'),tc=await login('c11@t.tn'),an=AN();
 const s=(await call('POST','/api/eleves',ta,{nom:'Pay',prenom:'Enfant',date_naissance:'2018-01-01',annee_entree:'2026',annee_scolaire:an})).j.id;db.prepare('INSERT INTO parent_eleve VALUES(?,?)').run(pr,s);
 await call('POST','/api/frais',ta,{eleve_id:s,libelle:'Scolarité',montant_millimes:500000,annee_scolaire:an});
 assert.equal((await call('GET','/api/paiement-en-ligne/config',tpr)).j.actif,true);
 assert.equal((await call('POST','/api/paiements-en-ligne',tpr,{eleve_id:s,montant_millimes:900000})).s,409,'au-delà du solde');assert.equal((await call('POST','/api/paiements-en-ligne',tpr,{eleve_id:s,montant_millimes:500})).s,400,'minimum 1 TND');
 assert.equal((await call('POST','/api/paiements-en-ligne',tpq,{eleve_id:s,montant_millimes:100000})).s,403,'autre parent');assert.equal((await call('POST','/api/paiements-en-ligne',tc,{eleve_id:s,montant_millimes:100000})).s,403,'réservé aux parents');
 const se=await call('POST','/api/paiements-en-ligne',tpr,{eleve_id:s,montant_millimes:200000});assert.equal(se.s,201);assert.equal((await call('GET','/api/paiements-en-ligne/'+se.j.token,tpq)).s,404,'session privée');
 const ok=await call('POST',`/api/paiements-en-ligne/${se.j.token}/confirmer`,tpr,{resultat:'succes'});assert.equal(ok.j.statut,'paye');assert.equal(ok.j.solde,300000);
 const row=db.prepare('SELECT * FROM paiements WHERE id=?').get(ok.j.paiement_id);assert.equal(row.mode,'carte_en_ligne');assert.equal(row.canal,'en_ligne');assert.match(row.reference,/^SIM-/);
 assert.equal((await call('POST',`/api/paiements-en-ligne/${se.j.token}/confirmer`,tpr,{resultat:'succes'})).s,409,'pas de double paiement');
 assert.ok((await call('GET','/api/messages',tpr)).j.some(m=>m.objet==='Confirmation de paiement'&&m.corps.includes('200.000')&&m.corps.includes('recu=')),'message au parent');
 const s2=await call('POST','/api/paiements-en-ligne',tpr,{eleve_id:s,montant_millimes:100000});assert.equal((await call('POST',`/api/paiements-en-ligne/${s2.j.token}/confirmer`,tpr,{resultat:'echec'})).j.statut,'echoue');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM paiements WHERE eleve_id=?').get(s).n,1,'un échec ne crée pas de paiement');
 const s3=await call('POST','/api/paiements-en-ligne',tpr,{eleve_id:s,montant_millimes:100000});db.prepare("UPDATE paiements_en_ligne SET created_at=datetime('now','-1 hour') WHERE token=?").run(s3.j.token);assert.equal((await call('POST',`/api/paiements-en-ligne/${s3.j.token}/confirmer`,tpr,{resultat:'succes'})).s,410,'session expirée');
 const rc=await fetch(base+`/api/paiements/${row.id}/recu`,{headers:{authorization:'Bearer '+tpr}});assert.equal(rc.status,200);assert.match(rc.headers.get('content-type'),/pdf/);const buf=Buffer.from(await rc.arrayBuffer());assert.equal(buf.subarray(0,5).toString(),'%PDF-');assert.ok(buf.length>5000,'PDF illustré');
 assert.equal((await fetch(base+`/api/paiements/${row.id}/recu`,{headers:{authorization:'Bearer '+tpq}})).status,403,"reçu d'un autre parent");
 const code=require('../src/lib/recu').codeRecu(row),vv=await call('GET',`/api/public/verifier-recu/${row.id}/${code}`);assert.equal(vv.j.valide,true);assert.equal(vv.j.nom,undefined,'aucun nom divulgué');assert.equal((await call('GET',`/api/public/verifier-recu/${row.id}/AAAAAAAAAA`)).j.valide,false);
 await call('PUT','/api/paiements/'+row.id,tc,{montant_millimes:250000});assert.equal((await call('GET',`/api/public/verifier-recu/${row.id}/${code}`)).j.valide,false,'reçu modifié : code invalide');
 const bl=await fetch(base+`/api/eleves/${s}/bulletin/1`,{headers:{authorization:'Bearer '+tpr}});assert.equal(bl.status,200);assert.equal(Buffer.from(await bl.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
 process.env.NODE_ENV='production';assert.equal((await call('GET','/api/paiement-en-ligne/config',tpr)).j.actif,false,'production réelle : désactivé par défaut');process.env.ALLOW_DEMO_SEED='true';assert.equal((await call('GET','/api/paiement-en-ligne/config',tpr)).j.actif,true,'mode démonstration : actif');delete process.env.ALLOW_DEMO_SEED;delete process.env.NODE_ENV;
 process.env.PAIEMENT_EN_LIGNE='desactive';assert.equal((await call('POST','/api/paiements-en-ligne',tpr,{eleve_id:s,montant_millimes:100000})).s,503);delete process.env.PAIEMENT_EN_LIGNE;
});
test('montant en lettres et appréciations',()=>{const{montantEnLettres:m}=require('../src/lib/lettres'),{appreciation:a}=require('../src/lib/theme');
 assert.equal(m(400000),'Quatre cents dinars');assert.equal(m(1500),'Un dinar et cinq cents millimes');assert.equal(m(80000),'Quatre-vingts dinars');assert.equal(m(80000000),'Quatre-vingt mille dinars');assert.equal(m(71000),'Soixante et onze dinars');
 assert.equal(a(17).etoiles,3);assert.equal(a(9).label,'À renforcer');assert.equal(a(null),null)});

test('connexion : seules les tentatives échouées sont limitées',async()=>{
 u('lim@t.tn','parent');
 for(let i=0;i<25;i++)assert.equal((await call('POST','/api/auth/login',null,{email:'lim@t.tn',password:'pw'})).s,200,'les connexions réussies ne bloquent pas');
 let last;for(let i=0;i<22;i++)last=(await call('POST','/api/auth/login',null,{email:'lim@t.tn',password:'faux'})).s;assert.equal(last,429,'trop d\'échecs → blocage');
});
