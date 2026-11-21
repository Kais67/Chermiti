const test=require('node:test'),assert=require('node:assert'),crypto=require('crypto'),fs=require('fs'),os=require('os'),path=require('path');
process.env.JWT_SECRET='test';
const PG=process.env.TEST_PG_URL;
test('migration SQLite → PostgreSQL : sauvegarde, comptages, refus si cible non vide, source intacte',{skip:!PG&&'TEST_PG_URL non défini'},async()=>{
 const{Client}=require('pg'),{open}=require('../src/db'),{seed}=require('../scripts/seed'),{migrerSqliteVersPg}=require('../scripts/migrer-sqlite-vers-pg');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mig-')),src=path.join(tmp,'school.db'),name='mig_'+crypto.randomBytes(4).toString('hex');
 const s=await open(src);await seed(s,{password:'Demo2026!'});await s.close();
 const h=()=>crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex'),avant=h();
 const a=new Client({connectionString:PG});await a.connect();await a.query(`CREATE DATABASE ${name}`);const u=new URL(PG);u.pathname='/'+name;const cible=u.toString();
 try{
  const sim=await migrerSqliteVersPg({source:src,cible,simulation:true,log(){}});assert.ok(sim.simulation);
  const p=await open(cible);assert.equal((await p.prepare('SELECT COUNT(*) n FROM users').get()).n,0,'simulation : rien écrit');await p.close();
  const r=await migrerSqliteVersPg({source:src,cible,log(){}});assert.ok(r.ok);assert.ok(fs.existsSync(r.sauvegarde),'sauvegarde créée');
  assert.ok(r.rapport.every(x=>x.source===x.cible));assert.ok(r.rapport.find(x=>x.table==='users').cible>=6);
  const p2=await open(cible);const nxt=(await p2.prepare("INSERT INTO annonces(auteur_id,titre,corps,cible) VALUES(1,'t','c','tous')").run()).lastInsertRowid;assert.ok(nxt>1,'séquences recalées');
  assert.equal((await p2.prepare("SELECT email FROM users WHERE role='admin'").get()).email,'admin@ecole.demo');await p2.close();
  await assert.rejects(()=>migrerSqliteVersPg({source:src,cible,log(){}}),/déjà des données/);
  assert.equal(h(),avant,'la base source est strictement inchangée');
 }finally{await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await a.end();fs.rmSync(tmp,{recursive:true,force:true})}});
