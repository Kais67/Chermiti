const test=require('node:test'),assert=require('node:assert'),http=require('http'),bcrypt=require('bcryptjs');
process.env.JWT_SECRET='test';delete process.env.PUBLIC_URL;
const mk=require('./helper');
let db,srv,base,fake,fakeUrl,st={flouci:'PENDING',konnect:'pending',montant:50000};
const hash=bcrypt.hashSync('Motdepasse123!',4);
const call=async(m,p,t,b)=>{const r=await fetch(base+p,{method:m,headers:{'content-type':'application/json',...(t&&{authorization:'Bearer '+t})},body:b&&JSON.stringify(b)});let j;const ct=r.headers.get('content-type')||'';try{j=ct.includes('json')?await r.json():await r.arrayBuffer()}catch{}return{s:r.status,j,ct}};
const login=async e=>(await call('POST','/api/auth/login',null,{email:e,password:'Motdepasse123!'})).j.token;
let T={},ids={};
test.before(async()=>{
 fake=http.createServer((q,r)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{const j=(o,s=200)=>{r.writeHead(s,{'content-type':'application/json'});r.end(JSON.stringify(o))};
  if(q.method==='POST'&&q.url==='/generate_payment'){const d=JSON.parse(b);st.lastFlouci=d;st.auth=q.headers.authorization;return j({result:{success:true,payment_id:'FPAY1',link:fakeUrl+'/pay/FPAY1'}})}
  if(q.url==='/verify_payment/FPAY1')return j({success:true,result:{status:st.flouci,amount:st.montant}});
  if(q.method==='POST'&&q.url==='/payments/init-payment'){st.lastKonnect=JSON.parse(b);st.kkey=q.headers['x-api-key'];return j({payUrl:fakeUrl+'/pay?payment_ref=KREF1',paymentRef:'KREF1'})}
  if(q.url==='/payments/KREF1')return j({payment:{status:st.konnect,amount:st.montant}});
  j({},404)})});
 await new Promise(r=>fake.listen(0,r));fakeUrl='http://127.0.0.1:'+fake.address().port;
 process.env.FLOUCI_BASE_URL=fakeUrl;process.env.KONNECT_BASE_URL=fakeUrl;
 db=await mk();const app=require('../src/app')(db);await new Promise(r=>{srv=app.listen(0,()=>{base='http://127.0.0.1:'+srv.address().port;r()})});
 const u=async(e,n,role)=>(await db.prepare('INSERT INTO users(email,password_hash,nom,role) VALUES(?,?,?,?)').run(e,hash,n,role)).lastInsertRowid;
 await db.prepare("INSERT INTO annees_scolaires(libelle,active) VALUES('2026-2027',1)").run();
 ids.admin=await u('adm@t.tn','Adm','admin');ids.compta=await u('cpt@t.tn','Cpt','comptable');ids.p1=await u('p1@t.tn','Parent 1','parent');ids.p2=await u('p2@t.tn','Parent 2','parent');
 ids.e=(await db.prepare("INSERT INTO eleves(nom,prenom,date_naissance,annee_entree,annee_scolaire) VALUES('Ben','Sami','2018-01-01','2026','2026-2027')").run()).lastInsertRowid;
 await db.prepare('INSERT INTO parent_eleve(parent_id,eleve_id) VALUES(?,?)').run(ids.p1,ids.e);
 await db.prepare("INSERT INTO frais(eleve_id,libelle,montant_millimes,annee_scolaire) VALUES(?,?,?,?)").run(ids.e,'Scolarité',500000,'2026-2027');
 for(const [k,e] of Object.entries({admin:'adm@t.tn',compta:'cpt@t.tn',p1:'p1@t.tn',p2:'p2@t.tn'}))T[k]=await login(e)});
test.after(async()=>{srv.close();fake.close();await db.close()});
const solde=async()=>(await db.prepare('SELECT COALESCE(SUM(montant_millimes),0) t FROM paiements WHERE eleve_id=?').get(ids.e)).t;

test('DEMO : paiement enregistré comme TEST, reçu filigrané, refusé en production réelle',async()=>{
 const cfg=(await call('GET','/api/paiement-en-ligne/config',T.p1)).j;assert.equal(cfg.actif,true);assert.equal(cfg.simule,true);assert.match(cfg.avertissement,/aucun argent réel/i);
 const s=await call('POST','/api/paiements-en-ligne',T.p1,{eleve_id:ids.e,montant_millimes:100000});assert.equal(s.s,201);assert.equal(s.j.fournisseur,'demo');assert.equal(s.j.simule,1);
 const c=await call('POST',`/api/paiements-en-ligne/${s.j.token}/confirmer`,T.p1,{resultat:'succes'});assert.equal(c.s,200);assert.equal(c.j.simule,true);
 const p=await db.prepare('SELECT * FROM paiements WHERE id=?').get(c.j.paiement_id);assert.equal(p.simule,1);assert.match(p.reference,/^SIM-/);
 const m=await db.prepare("SELECT corps FROM messages WHERE destinataire_id=? ORDER BY id DESC").get(ids.p1);assert.match(m.corps,/PAIEMENT DE TEST/);
 const pdf=await call('GET',`/api/paiements/${p.id}/recu`,T.p1);assert.equal(pdf.s,200);assert.ok(pdf.ct.includes('pdf'));
 process.env.NODE_ENV='production';try{
  assert.equal((await call('GET','/api/paiement-en-ligne/config',T.p1)).j.actif,false,'DEMO désactivée en production réelle');
  assert.equal((await call('POST','/api/paiements-en-ligne',T.p1,{eleve_id:ids.e,montant_millimes:100000})).s,503);
 }finally{process.env.NODE_ENV='test'}});

test('Flouci (sandbox = TEST) : clés chiffrées, session, vérification serveur, idempotence, montant contrôlé',async()=>{
 assert.equal((await call('PUT','/api/admin/paiement/config/flouci',T.p1,{actif:true})).s,403,'réservé à l\'admin');
 assert.equal((await call('PUT','/api/admin/paiement/config/flouci',T.admin,{actif:true,mode:'sandbox'})).s,400,'clés manquantes');
 assert.equal((await call('PUT','/api/admin/paiement/config/flouci',T.admin,{actif:true,mode:'sandbox',secrets:{public:'PUB',private:'PRIV-SECRET'}})).s,200);
 const raw=await db.prepare("SELECT secrets FROM config_paiement WHERE fournisseur='flouci'").get();assert.ok(raw.secrets.startsWith('enc:')&&!raw.secrets.includes('PRIV-SECRET'),'secret chiffré en base');
 const cfg=await call('GET','/api/admin/paiement/config',T.admin);assert.ok(!JSON.stringify(cfg.j).includes('PRIV-SECRET'),'secret jamais renvoyé');
 const s=await call('POST','/api/paiements-en-ligne',T.p1,{eleve_id:ids.e,montant_millimes:50000});assert.equal(s.s,201);assert.equal(s.j.fournisseur,'flouci');assert.equal(s.j.simule,1);assert.ok(s.j.url.includes('/pay/FPAY1'));
 assert.equal(st.auth,'Bearer PUB:PRIV-SECRET');assert.equal(st.lastFlouci.amount,'50000');assert.match(st.lastFlouci.success_link,/\/paiement\/.+retour=1/);
 const avant=await solde();
 assert.equal((await call('POST',`/api/paiements-en-ligne/${s.j.token}/verifier`,T.p1)).j.statut,'en_attente');assert.equal(await solde(),avant,'rien enregistré tant que non payé');
 assert.equal((await call('POST',`/api/paiements-en-ligne/${s.j.token}/confirmer`,T.p1,{resultat:'succes'})).s,503,'la confirmation DEMO ne marche pas sur un vrai fournisseur');
 st.flouci='SUCCESS';const v=await call('POST',`/api/paiements-en-ligne/${s.j.token}/verifier`,T.p1);assert.equal(v.j.statut,'paye');assert.equal(v.j.simule,true);
 const p=await db.prepare('SELECT * FROM paiements WHERE id=?').get(v.j.paiement_id);assert.equal(p.simule,1);assert.equal(p.reference,'FLOUCI-FPAY1');
 await call('POST',`/api/paiements-en-ligne/${s.j.token}/verifier`,T.p1);assert.equal(await solde(),avant+50000,'idempotent : un seul paiement');
 assert.equal((await call('GET',`/api/paiements-en-ligne/${s.j.token}`,T.p2)).s,404,"un autre parent n'accède pas à la session");
 // mode réel (live) : exige une adresse HTTPS, puis le paiement n'est plus marqué TEST
 assert.equal((await call('PUT','/api/admin/paiement/config/flouci',T.admin,{actif:true,mode:'live'})).s,400,'live exige HTTPS');process.env.PUBLIC_URL='https://ecole.example.tn';
 await call('PUT','/api/admin/paiement/config/flouci',T.admin,{actif:true,mode:'live'});
 st.flouci='PENDING';st.montant=1;const s2=await call('POST','/api/paiements-en-ligne',T.p1,{eleve_id:ids.e,montant_millimes:50000});assert.equal(s2.j.simule,0);
 st.flouci='SUCCESS';const bad=await call('POST',`/api/paiements-en-ligne/${s2.j.token}/verifier`,T.p1);assert.equal(bad.s,409,'montant incohérent refusé');assert.equal(await solde(),avant+50000);
 await call('PUT','/api/admin/paiement/config/flouci',T.admin,{actif:false});st.montant=50000;delete process.env.PUBLIC_URL});

test('Konnect : webhook vérifié auprès du fournisseur, jamais cru sur parole',async()=>{
 await call('PUT','/api/admin/paiement/config/konnect',T.admin,{actif:true,mode:'sandbox',secrets:{apiKey:'KEY',walletId:'WAL1'}});
 const s=await call('POST','/api/paiements-en-ligne',T.p1,{eleve_id:ids.e,montant_millimes:50000,fournisseur:'konnect'});assert.equal(s.s,201);assert.equal(st.kkey,'KEY');assert.equal(st.lastKonnect.receiverWalletId,'WAL1');assert.equal(st.lastKonnect.amount,50000);assert.equal(st.lastKonnect.token,'TND');
 const avant=await solde();
 assert.equal((await call('GET',`/api/webhooks/konnect?token=${s.j.token}&payment_ref=KREF1`)).s,200);assert.equal(await solde(),avant,'webhook sans paiement confirmé : rien');
 assert.equal((await call('GET','/api/webhooks/konnect?token=inconnu')).s,404);
 st.konnect='completed';assert.equal((await call('GET',`/api/webhooks/konnect?token=${s.j.token}`)).s,200);assert.equal(await solde(),avant+50000);
 await call('GET',`/api/webhooks/konnect?token=${s.j.token}`);assert.equal(await solde(),avant+50000,'webhook rejoué : idempotent');
 await call('PUT','/api/admin/paiement/config/konnect',T.admin,{actif:false})});

test('Espèces : demande du parent, validation obligatoire par le secrétariat',async()=>{
 const avant=await solde(),du=500000-avant;
 assert.equal((await call('POST','/api/paiements-especes',T.p2,{eleve_id:ids.e,montant_millimes:10000})).s,403,'parent non lié');
 assert.equal((await call('POST','/api/paiements-especes',T.p1,{eleve_id:ids.e,montant_millimes:du+1000})).s,409,'dépasse le solde');
 const d=await call('POST','/api/paiements-especes',T.p1,{eleve_id:ids.e,montant_millimes:40000});assert.equal(d.s,201);assert.match(d.j.reference,/^ESP-/);
 assert.equal(await solde(),avant,"aucun paiement tant que le secrétariat n'a pas validé");
 assert.ok((await db.prepare("SELECT COUNT(*) n FROM notifications WHERE texte LIKE ?").get('%'+d.j.reference+'%')).n>=2,'secrétariat notifié');
 assert.equal((await call('POST',`/api/paiements-especes/${d.j.id}/valider`,T.p1,{})).s,403,'le parent ne valide pas');
 const v=await call('POST',`/api/paiements-especes/${d.j.id}/valider`,T.compta,{});assert.equal(v.s,200);assert.equal(await solde(),avant+40000);
 const p=await db.prepare('SELECT * FROM paiements WHERE id=?').get(v.j.paiement_id);assert.equal(p.mode,'especes');assert.equal(p.simule,0);assert.equal(p.reference,d.j.reference);
 assert.equal((await call('POST',`/api/paiements-especes/${d.j.id}/valider`,T.compta,{})).s,409,'pas de double validation');assert.equal(await solde(),avant+40000);
 const d2=await call('POST','/api/paiements-especes',T.p1,{eleve_id:ids.e,montant_millimes:20000});
 assert.equal((await call('POST',`/api/paiements-especes/${d2.j.id}/annuler`,T.p2,{})).s,403);
 assert.equal((await call('POST',`/api/paiements-especes/${d2.j.id}/refuser`,T.admin,{motif:'Montant non reçu'})).s,200);assert.equal(await solde(),avant+40000);
 assert.equal((await call('GET','/api/paiements-especes?statut=refusee',T.compta)).j.length,1);
 const d3=await call('POST','/api/paiements-especes',T.p1,{eleve_id:ids.e,montant_millimes:20000});await db.prepare("UPDATE demandes_especes SET created_at=datetime('now','-20 days') WHERE id=?").run(d3.j.id);
 assert.equal((await call('POST',`/api/paiements-especes/${d3.j.id}/valider`,T.compta,{})).s,410,'demande expirée');
 assert.equal((await call('GET','/api/paiements-especes',T.p2)).j.length,0,'chaque parent ne voit que ses demandes')});
