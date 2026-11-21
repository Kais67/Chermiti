const test=require('node:test'),assert=require('node:assert'),crypto=require('crypto'),fs=require('fs'),os=require('os'),path=require('path');
process.env.JWT_SECRET='test';process.env.SUPER_ADMIN_EMAIL='root@plateforme.tn';process.env.SUPER_ADMIN_PASSWORD='SuperSecret123';
delete process.env.DEFAULT_ECOLE_SLUG;delete process.env.DB_FILE;delete process.env.ALLOW_DEMO_SEED;
const PG=process.env.TEST_PG_URL,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ecoles-')),sfx=crypto.randomBytes(3).toString('hex');
process.env.DATA_DIR=tmp;process.env.UPLOADS_DIR=path.join(tmp,'up');
let srv,base,srvObj,admin,platformName;
const call=async(m,p,t,b,h={})=>{const r=await fetch(base+p,{method:m,headers:{'content-type':'application/json',...(t&&{authorization:'Bearer '+t}),...h},body:b&&JSON.stringify(b)});let j;try{j=await r.json()}catch{}return{s:r.status,j}};
test.before(async()=>{
 let target;
 if(PG){const{Client}=require('pg');admin=new Client({connectionString:PG});await admin.connect();platformName='pf_'+sfx;await admin.query(`CREATE DATABASE ${platformName}`);const u=new URL(PG);u.pathname='/'+platformName;target=u.toString();process.env.PG_ADMIN_URL=PG}
 else target=path.join(tmp,'platform.db');
 const{createServer}=require('../src/main');srvObj=await createServer({platformTarget:target});
 await new Promise(r=>{srv=srvObj.app.listen(0,()=>{base='http://127.0.0.1:'+srv.address().port;r()})})});
test.after(async()=>{srv.close();await srvObj.tenants.closeAll();await srvObj.platform.close();
 if(PG){const l=(await admin.query('SELECT datname FROM pg_database WHERE datname LIKE $1 OR datname=$2',['ecole\\_t'+sfx+'%',platformName])).rows.map(r=>r.datname);for(const n of l)await admin.query(`DROP DATABASE IF EXISTS "${n}" WITH (FORCE)`);await admin.end()}
 fs.rmSync(tmp,{recursive:true,force:true})});
test('multi-écoles : création, isolation des données et des jetons, suspension',async()=>{
 const A='t'+sfx+'-a',B='t'+sfx+'-b';
 assert.equal((await call('GET','/api/plateforme/ecoles')).s,401,'plateforme protégée');
 assert.equal((await call('POST','/api/plateforme/login',null,{email:'root@plateforme.tn',password:'faux'})).s,401);
 const sa=(await call('POST','/api/plateforme/login',null,{email:'root@plateforme.tn',password:'SuperSecret123'})).j.token;assert.ok(sa);
 const mk=(slug,nom,email,langue)=>call('POST','/api/plateforme/ecoles',sa,{slug,nom,langue_defaut:langue,admin:{email,password:'MotDePasse123',nom:'Dir '+nom}});
 assert.equal((await mk('X','Trop court','a@a.tn')).s,400,'identifiant invalide');
 assert.equal((await mk(A,'École A','a@a.tn','fr')).s,201);assert.equal((await mk(B,'École B','b@b.tn','ar')).s,201);
 assert.equal((await mk(A,'Doublon','c@c.tn')).s,409,'identifiant déjà pris');
 assert.equal((await call('GET','/api/plateforme/ecoles',sa)).j.length,2);
 const h=s=>({'x-ecole':s});
 assert.equal((await call('GET','/api/public/annonces')).j.code,'ECOLE_REQUISE','plusieurs écoles : code requis');
 assert.equal((await call('GET','/api/public/ecole',null,null,h('inconnue'))).s,404);
 assert.equal((await call('GET','/api/public/ecole',null,null,h(B))).j.langue_defaut,'ar');
 const lg=(s,e)=>call('POST','/api/auth/login',null,{email:e,password:'MotDePasse123'},h(s));
 assert.equal((await lg(B,'a@a.tn')).s,401,"l'admin de A n'existe pas dans B");
 const ta=(await lg(A,'a@a.tn')).j.token,tb=(await lg(B,'b@b.tn')).j.token;assert.ok(ta&&tb);
 assert.equal((await call('GET','/api/auth/moi',ta,null,h(B))).s,401,'jeton de A refusé par B');
 assert.equal((await call('GET','/api/auth/moi',ta,null,h(A))).s,200);
 const cl=await call('POST','/api/classes',ta,{niveau:'1re année',section:'A',capacite:20,annee_scolaire:(await call('GET','/api/annees',ta,null,h(A))).j[0].libelle},h(A));assert.equal(cl.s,201,JSON.stringify(cl.j));
 assert.equal((await call('GET','/api/classes',ta,null,h(A))).j.length,1);assert.equal((await call('GET','/api/classes',tb,null,h(B))).j.length,0,'bases indépendantes');
 assert.equal((await call('PUT','/api/plateforme/ecoles/'+B,sa,{statut:'suspendue'})).s,200);
 assert.equal((await call('GET','/api/classes',tb,null,h(B))).j.code,'ECOLE_SUSPENDUE');
 assert.equal((await call('GET','/api/classes',ta,null,h(A))).s,200,'A non affectée');
 const st=await call('GET','/api/plateforme/ecoles/'+A+'/stats',sa);assert.equal(st.j.classes,1);
 assert.equal(srvObj.tenants.cache.get(A).db.driver,PG?'pg':'sqlite');
});

test('SaaS : abonnement (plan, expiration), modification, réinitialisation du mot de passe administrateur',async()=>{
 const C='t'+sfx+'-c',sa=(await call('POST','/api/plateforme/login',null,{email:'root@plateforme.tn',password:'SuperSecret123'})).j.token,h={'x-ecole':C};
 assert.equal((await call('POST','/api/plateforme/ecoles',sa,{slug:C,nom:'École C',plan:'platine',admin:{email:'c@c.tn',password:'MotDePasse123'}})).s,400,'plan inconnu refusé');
 assert.equal((await call('POST','/api/plateforme/ecoles',sa,{slug:C,nom:'École C',plan:'standard',fin_abonnement:'2999-12-31',contact:{nom:'Mme C',email:'contact@c.tn'},admin:{email:'c@c.tn',password:'MotDePasse123'}})).s,201);
 const l=(await call('GET','/api/plateforme/ecoles',sa)).j.find(e=>e.slug===C);assert.equal(l.plan,'standard');assert.equal(l.fin_abonnement,'2999-12-31');assert.equal(l.contact_email,'contact@c.tn');
 assert.equal((await call('POST','/api/auth/login',null,{email:'c@c.tn',password:'MotDePasse123'},h)).s,200);
 // expiration : l'école est bloquée, les autres non ; prolongation → rétablie
 assert.equal((await call('PUT','/api/plateforme/ecoles/'+C,sa,{fin_abonnement:'2020-01-01'})).s,200);
 const ex=await call('POST','/api/auth/login',null,{email:'c@c.tn',password:'MotDePasse123'},h);assert.equal(ex.s,403);assert.equal(ex.j.code,'ABONNEMENT_EXPIRE');
 assert.equal((await call('GET','/api/public/ecole',null,null,{'x-ecole':'t'+sfx+'-a'})).s,200,'les autres écoles ne sont pas touchées');
 assert.equal((await call('PUT','/api/plateforme/ecoles/'+C,sa,{fin_abonnement:'2999-12-31',plan:'premium',nom:'École C renommée'})).s,200);
 assert.equal((await call('GET','/api/public/ecole',null,null,h)).j.nom,'École C renommée');
 assert.equal((await call('PUT','/api/plateforme/ecoles/'+C,sa,{fin_abonnement:'31/12/2999'})).s,400,'date invalide');
 // mot de passe administrateur oublié
 assert.equal((await call('POST',`/api/plateforme/ecoles/${C}/reinitialiser-admin`,null,{})).s,401,'réservé au super-administrateur');
 const rr=await call('POST',`/api/plateforme/ecoles/${C}/reinitialiser-admin`,sa,{});assert.equal(rr.s,200);assert.equal(rr.j.email,'c@c.tn');
 assert.equal((await call('POST','/api/auth/login',null,{email:'c@c.tn',password:'MotDePasse123'},h)).s,401,'ancien mot de passe invalide');
 const nl=await call('POST','/api/auth/login',null,{email:'c@c.tn',password:rr.j.mot_de_passe_temporaire},h);assert.equal(nl.s,200);assert.equal(nl.j.user.mdp_temporaire,true,'changement de mot de passe imposé');
 assert.equal((await call('POST',`/api/plateforme/ecoles/inconnue/reinitialiser-admin`,sa,{})).s,404)});

test('URL de base par école : TCP classique et socket Cloud SQL',()=>{
 const{avecBase}=require('../src/plateforme/tenants');
 assert.equal(avecBase('postgres://u:p@h:5432/postgres','ecole_a'),'postgres://u:p@h:5432/ecole_a');
 assert.equal(avecBase('postgres://u:p%40x@/plateforme?host=/cloudsql/proj:europe-west1:inst','ecole_a'),'postgres://u:p%40x@/ecole_a?host=/cloudsql/proj:europe-west1:inst');
 assert.equal(avecBase('postgresql://u:p@h/postgres?sslmode=require','ecole_a'),'postgresql://u:p@h/ecole_a?sslmode=require');
 assert.throws(()=>avecBase('mysql://x','y'))});
