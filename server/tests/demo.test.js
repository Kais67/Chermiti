// Écoles de démonstration (A et B) : 6 profils chacune, droits par rôle, tableaux BI, ISOLATION entre écoles dans les deux sens.
const test=require('node:test'),assert=require('node:assert'),crypto=require('crypto'),fs=require('fs'),os=require('os'),path=require('path'),bcrypt=require('bcryptjs');
process.env.JWT_SECRET='test';process.env.DEMO_ECOLES='true';process.env.ALLOW_DEMO_SEED='true';delete process.env.DEFAULT_ECOLE_SLUG;delete process.env.DB_FILE;
const PG=process.env.TEST_PG_URL,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'demo-')),sfx=crypto.randomBytes(3).toString('hex');
process.env.DATA_DIR=tmp;process.env.UPLOADS_DIR=path.join(tmp,'up');
const{ECOLES}=require('../scripts/seed-demo');
// en PostgreSQL : slugs uniques par exécution (bases ecole_<slug> créées puis supprimées)
if(PG)for(const e of ECOLES){e.slugReel=e.slug+'-'+sfx}else for(const e of ECOLES)e.slugReel=e.slug;
let srv,base,S,admin;const A=()=>ECOLES[0],B=()=>ECOLES[1];
const call=async(m,p,t,b,ecole)=>{const r=await fetch(base+p,{method:m,headers:{'content-type':'application/json',...(t&&{authorization:'Bearer '+t}),...(ecole&&{'x-ecole':ecole})},body:b&&JSON.stringify(b)});let j;try{j=await r.json()}catch{}return{s:r.status,j}};
const T={};const ROLES=['admin','directeur','enseignant','comptable','parent','eleve'];
test.before(async()=>{
 let target;if(PG){const{Client}=require('pg');admin=new Client({connectionString:PG});await admin.connect();S='pf_'+sfx;await admin.query(`CREATE DATABASE ${S}`);const u=new URL(PG);u.pathname='/'+S;target=u.toString();process.env.PG_ADMIN_URL=PG}else target=path.join(tmp,'platform.db');
 // en PG on renomme les slugs pour ne pas entrer en collision
 const seedMod=require('../scripts/seed-demo');const orig=seedMod.ECOLES.map(e=>e.slug);if(PG)seedMod.ECOLES.forEach(e=>e.slug=e.slugReel);
 const{createServer}=require('../src/main');S=await createServer({platformTarget:target});if(PG)seedMod.ECOLES.forEach((e,i)=>e.slug=orig[i]);
 await new Promise(r=>{srv=S.app.listen(0,()=>{base='http://127.0.0.1:'+srv.address().port;r()})});
 for(const e of ECOLES){T[e.code]={};for(const r of ROLES){const x=await call('POST','/api/auth/login',null,{email:`${r}.${e.code}@demo.tn`,password:e.password},e.slugReel);assert.equal(x.s,200,`connexion ${r}.${e.code}`);T[e.code][r]=x.j.token;T[e.code][r+'_user']=x.j.user}}});
test.after(async()=>{srv.close();await S.tenants.closeAll();await S.platform.close();
 if(PG){const l=(await admin.query('SELECT datname FROM pg_database WHERE datname LIKE $1 OR datname=$2',['ecole\\_ecole\\_%'+sfx,'pf_'+sfx])).rows.map(r=>r.datname);for(const n of l)await admin.query(`DROP DATABASE IF EXISTS "${n}" WITH (FORCE)`);await admin.end()}
 fs.rmSync(tmp,{recursive:true,force:true})});
const db=c=>S.tenants.get(ECOLES.find(e=>e.code===c).slugReel).then(t=>t.db);
const ec=c=>ECOLES.find(e=>e.code===c).slugReel;

test('les 6 profils de chaque école se connectent ; le directeur est identifié',async()=>{
 for(const c of['a','b']){assert.equal(T[c].directeur_user.fonction,'directeur');assert.equal(T[c].admin_user.role,'admin');assert.equal(T[c].parent_user.role,'parent');assert.equal(T[c].eleve_user.role,'eleve')}
 assert.equal((await call('POST','/api/auth/login',null,{email:'admin.a@demo.tn',password:'faux'},ec('a'))).s,401)});

test('droits par rôle (matrice)',async()=>{
 for(const c of['a','b']){const g=(p,r)=>call('GET',p,T[c][r],null,ec(c));
  assert.equal((await g('/api/utilisateurs','admin')).s,200,'admin gère les comptes');assert.equal((await g('/api/utilisateurs','directeur')).s,403,'directeur ne gère pas les comptes');
  for(const t of['general','financier','pedagogique','absences','enseignants','communications','salles','risques','strategique']){assert.equal((await g('/api/bi/'+t,'directeur')).s,200,'BI '+t+' directeur');assert.equal((await g('/api/bi/'+t,'admin')).s,200)}
  assert.equal((await g('/api/bi/financier','comptable')).s,200);assert.equal((await g('/api/bi/pedagogique','comptable')).s,403,'comptable : finance seulement');
  for(const r of['enseignant','parent','eleve'])assert.equal((await g('/api/bi/general',r)).s,403,'BI interdit à '+r);
  assert.equal((await call('POST','/api/paiements',T[c].enseignant,{eleveId:1,montant:1000,mode:'especes'},ec(c))).s,403,'enseignant ne saisit pas de paiement');
  const tous=(await g('/api/eleves','admin')).j,mes=(await g('/api/eleves','parent')).j,prof=(await g('/api/eleves','enseignant')).j,moi=(await g('/api/eleves','eleve')).j;
  const d=await db(c),pid=T[c].parent_user.id,liens=(await d.prepare('SELECT eleve_id FROM parent_eleve WHERE parent_id=?').all(pid)).map(x=>x.eleve_id);
  assert.ok(tous.length>200);assert.ok(mes.length>=1&&mes.every(e=>liens.includes(e.id)),'le parent ne voit que ses enfants');assert.ok(prof.length>0&&prof.length<tous.length/4,'enseignant : seulement ses classes');assert.equal(moi.length,1,"l'élève ne voit que lui-même")}});

test('BI : indicateurs cohérents avec la base',async()=>{
 const d=await db('a'),n=(await d.prepare('SELECT COUNT(*) n FROM eleves WHERE deleted_at IS NULL').get()).n;
 const g=(await call('GET','/api/bi/general',T.a.directeur,null,ec('a'))).j;assert.equal(g.kpis.eleves,n);assert.ok(g.alertes.some(a=>/surchargée/.test(a.message)),'classe surchargée détectée');assert.ok(g.alertes.some(a=>/sous-remplie/.test(a.message)));
 const pdfs=require('../src/pdf'),pa=(await d.prepare('SELECT id FROM paiements ORDER BY id').get()).id,db2=await db('b');
 assert.equal((await pdfs.recuData(d,pa)).ecole,ECOLES[0].nom,"reçu A : nom de l'école A");assert.equal((await pdfs.recuData(db2,(await db2.prepare('SELECT id FROM paiements ORDER BY id').get()).id)).ecole,ECOLES[1].nom,"reçu B : nom de l'école B");
 const f=(await call('GET','/api/bi/financier',T.a.directeur,null,ec('a'))).j,paye=(await d.prepare('SELECT SUM(montant_millimes) s FROM paiements WHERE annee_scolaire=? AND deleted_at IS NULL').get('2026-2027')).s;
 assert.equal(f.kpis.encaisse_millimes,paye);assert.ok(f.kpis.taux_recouvrement>0&&f.kpis.taux_recouvrement<100);assert.equal(f.kpis.attendu_millimes-f.kpis.encaisse_millimes,f.kpis.reste_millimes);assert.ok(f.retards.length>0&&f.prevision.length===3);
 const r=(await call('GET','/api/bi/risques',T.a.directeur,null,ec('a'))).j;assert.ok(r.alertes.length>0&&r.kpis.risque_echec>0&&r.alertes[0].raisons.length>0);
 const s=(await call('GET','/api/bi/strategique',T.a.directeur,null,ec('a'))+'');assert.ok(s);const st=(await call('GET','/api/bi/strategique?croissance=12',T.a.directeur,null,ec('a'))).j;assert.ok(st.scenarios.some(x=>x.scenario==='Personnalisé'&&x.croissance_pct===12)&&st.recommandations.length>0);
 assert.equal((await call('GET','/api/bi/salles',T.a.directeur,null,ec('a'))).j.kpis.conflits_horaires,0,'emploi du temps sans conflit');
 assert.equal((await call('GET','/api/bi/inconnu',T.a.directeur,null,ec('a'))).s,404)});

test('ISOLATION A→B et B→A : jetons, listes, identifiants devinés, modification, statistiques',async()=>{
 const da=await db('a'),dbb=await db('b');
 // 1. un jeton d'une école est refusé par l'autre (dans les deux sens, tous les profils)
 for(const[x,y]of[['a','b'],['b','a']])for(const r of ROLES)assert.equal((await call('GET','/api/auth/moi',T[x][r],null,ec(y))).s,401,`jeton ${r} de ${x} refusé par ${y}`);
 // 2. listes : marqueurs reconnaissables (« A-Élève1 », « B-Élève1 »)
 await da.prepare("UPDATE eleves SET prenom='A-Élève1' WHERE id=1").run();await dbb.prepare("UPDATE eleves SET prenom='B-Élève1' WHERE id=1").run();
 const la=(await call('GET','/api/eleves',T.a.admin,null,ec('a'))).j.map(e=>e.prenom),lb=(await call('GET','/api/eleves',T.b.admin,null,ec('b'))).j.map(e=>e.prenom);
 assert.ok(la.includes('A-Élève1')&&!la.includes('B-Élève1'));assert.ok(lb.includes('B-Élève1')&&!lb.includes('A-Élève1'));
 // 3. identifiants devinés : une ligne qui n'existe que dans l'autre école → introuvable (dans les deux sens)
 await da.prepare('DELETE FROM preinscriptions WHERE id=1').run();await dbb.prepare('DELETE FROM preinscriptions WHERE id=6').run();
 assert.equal((await call('PUT','/api/preinscriptions/1/statut',T.a.admin,{statut:'refusee'},ec('a'))).s,404,"B-only dans A");
 assert.equal((await call('PUT','/api/preinscriptions/6/statut',T.b.admin,{statut:'refusee'},ec('b'))).s,404,"A-only dans B");
 assert.equal((await call('PUT','/api/preinscriptions/1/statut',T.b.admin,{statut:'refusee'},ec('b'))).s,200,'contrôle : la ligne existe bien dans B');
 

 // 4. paiements / reçus / bulletins : un jeton de l'autre école ne passe pas, même avec le bon identifiant
 const pidB=(await dbb.prepare('SELECT id,eleve_id FROM paiements ORDER BY id DESC').get());
 assert.equal((await call('GET',`/api/paiements/${pidB.id}/recu`,T.a.admin,null,ec('b'))).s,401);assert.equal((await call('GET',`/api/eleves/${pidB.eleve_id}/bulletin/1`,T.a.admin,null,ec('b'))).s,401);
 assert.equal((await call('DELETE',`/api/paiements/${pidB.id}`,T.a.admin,null,ec('b'))).s,401);assert.ok(await dbb.prepare('SELECT 1 FROM paiements WHERE id=?').get(pidB.id),'paiement de B intact');
 // 5. statistiques / BI : chaque école ne compte que ses données
 await da.prepare("INSERT INTO eleves(nom,prenom,date_naissance,annee_entree,annee_scolaire) VALUES('Seul','A-Only','2018-01-01','2026','2026-2027')").run();
 const ga=(await call('GET','/api/bi/general',T.a.directeur,null,ec('a'))).j.kpis.eleves,gb=(await call('GET','/api/bi/general',T.b.directeur,null,ec('b'))).j.kpis.eleves;
 assert.equal(ga,(await da.prepare('SELECT COUNT(*) n FROM eleves WHERE deleted_at IS NULL').get()).n);assert.equal(gb,(await dbb.prepare('SELECT COUNT(*) n FROM eleves WHERE deleted_at IS NULL').get()).n);assert.notEqual(ga,gb);
 // 6. fichiers : dossier de dépôt distinct par école
 assert.notEqual((await S.tenants.get(ec('a'))).db.uploadsDir,(await S.tenants.get(ec('b'))).db.uploadsDir);
 // 7. même e-mail dans les deux écoles : la connexion distingue par l'école
 const h1=bcrypt.hashSync('MdpEcoleA-12345',6),h2=bcrypt.hashSync('MdpEcoleB-12345',6);
 await da.prepare("INSERT INTO users(email,password_hash,nom,role) VALUES('commun@demo.tn',?,'Commun','parent')").run(h1);await dbb.prepare("INSERT INTO users(email,password_hash,nom,role) VALUES('commun@demo.tn',?,'Commun','parent')").run(h2);
 assert.equal((await call('POST','/api/auth/login',null,{email:'commun@demo.tn',password:'MdpEcoleA-12345'},ec('a'))).s,200);assert.equal((await call('POST','/api/auth/login',null,{email:'commun@demo.tn',password:'MdpEcoleA-12345'},ec('b'))).s,401);
 // 8. tâches de fond : les relances reçoivent explicitement l'école
 const avantB=(await dbb.prepare('SELECT COUNT(*) n FROM journal_envois').get()).n;await require('../src/services/relances').lancer(da,{jours:7});
 assert.equal((await dbb.prepare('SELECT COUNT(*) n FROM journal_envois').get()).n,avantB,'les relances de A ne touchent pas B');assert.ok((await da.prepare('SELECT COUNT(*) n FROM journal_envois').get()).n>0,'relances envoyées dans A')});
