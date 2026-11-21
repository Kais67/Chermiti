// Migration sécurisée d'une base SQLite existante vers une base PostgreSQL d'école.
//   node scripts/migrer-sqlite-vers-pg.js --source data/school.db --cible postgres://… [--simulation] [--basculer slug]
// Garanties : (1) sauvegarde horodatée + empreinte SHA-256 AVANT toute action ; (2) la base d'origine n'est jamais modifiée
// (on travaille sur la copie) ; (3) la cible doit être vide ; (4) tout se fait dans UNE transaction, annulée si un contrôle échoue.
require('dotenv').config({path:require('path').join(__dirname,'../../.env')});
const fs=require('fs'),path=require('path'),crypto=require('crypto'),Database=require('../src/db/sqlite');
const arg=n=>{const i=process.argv.indexOf('--'+n);return i<0?null:(process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:true)};
const ORDRE=['annees_scolaires','users','classes','matieres','eleves','parent_eleve','salles','creneaux','evaluations','notes','frais','paiements','messages','notifications','audit_log',
 'devoirs','depots','absences','annonces','preinscriptions','acces_messages','affectations','tarifs','depot_fichiers','journal_envois','paiements_en_ligne','felicitations','config_paiement','demandes_especes'];
const AUTO_REF={messages:['reponse_a']}; // références vers la même table : remplies après l'insertion
async function migrerSqliteVersPg({source,cible,simulation=false,log=console.log}){
 const{open,migrate}=require('../src/db');
 if(!source||!fs.existsSync(source))throw new Error('Base source introuvable : '+source);
 if(!/^postgres(ql)?:\/\//.test(cible||''))throw new Error('--cible doit être une URL PostgreSQL');
 // 1. Sauvegarde vérifiée
 const dir=path.join(path.dirname(path.resolve(source)),'backups');fs.mkdirSync(dir,{recursive:true});
 const copie=path.join(dir,`avant-migration-pg-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);
 const src0=new Database(source,{readonly:true});await src0.backup(copie);src0.close();
 const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
 const chk=new Database(copie,{readonly:true});if(chk.pragma('integrity_check',{simple:true})!=='ok')throw new Error('Sauvegarde corrompue : migration annulée');chk.close();
 log('Sauvegarde créée :',copie,'SHA-256',sha(copie).slice(0,16)+'…');
 // 2. On travaille sur une copie de la sauvegarde, mise à niveau (migrations SQLite) si besoin
 const travail=copie+'.travail';fs.copyFileSync(copie,travail);
 const sdb=await open(travail);const raw=sdb._d.raw;
 // 3. Cible vide uniquement
 const pg=await open(cible,{max:4});
 try{
  if((await pg.prepare('SELECT COUNT(*) n FROM users').get()).n>0)throw new Error('La base cible contient déjà des données : migration refusée (aucune donnée écrasée)');
  const rapport=[];
  await pg.transaction(async()=>{
   for(const t of ORDRE){
    const sc=raw.prepare(`PRAGMA table_info(${t})`).all().map(c=>c.name);if(!sc.length)continue;
    const pc=(await pg.prepare("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=?").all(t)).map(c=>c.column_name);
    const cols=sc.filter(c=>pc.includes(c)),skipped=sc.filter(c=>!pc.includes(c));if(skipped.length)throw new Error(`Colonnes sans équivalent PostgreSQL dans ${t} : ${skipped.join(', ')}`);
    const selfRefs=AUTO_REF[t]||[],ins=cols.map(c=>selfRefs.includes(c)?'NULL':'?');
    const rows=raw.prepare(`SELECT ${cols.join(',')} FROM ${t} ORDER BY ${cols.includes('id')?'id':'rowid'}`).all();
    const sql=`INSERT INTO ${t}(${cols.join(',')}) ${cols.includes('id')?'OVERRIDING SYSTEM VALUE ':''}VALUES(${ins.join(',')})`;
    for(const r of rows)await pg.prepare(sql).run(...cols.filter(c=>!selfRefs.includes(c)).map(c=>r[c]));
    for(const c of selfRefs)if(cols.includes(c))for(const r of rows.filter(x=>x[c]!=null))await pg.prepare(`UPDATE ${t} SET ${c}=? WHERE id=?`).run(r[c],r.id);
    if(cols.includes('id'))await pg.prepare(`SELECT setval(pg_get_serial_sequence('${t}','id'),COALESCE((SELECT MAX(id) FROM ${t}),1),(SELECT MAX(id) IS NOT NULL FROM ${t}))`).get();
    rapport.push({table:t,source:rows.length,cible:(await pg.prepare(`SELECT COUNT(*) n FROM ${t}`).get()).n})}
   // 4. Contrôles d'intégrité avant validation
   for(const r of rapport)if(r.source!==r.cible)throw new Error(`Écart de comptage sur ${r.table} : ${r.source} ≠ ${r.cible}`);
   const a=raw.prepare('SELECT COALESCE(SUM(montant_millimes),0) s FROM paiements WHERE deleted_at IS NULL').get().s,b=(await pg.prepare('SELECT COALESCE(SUM(montant_millimes),0) s FROM paiements WHERE deleted_at IS NULL').get()).s;
   if(a!==b)throw new Error(`Total des paiements différent : ${a} ≠ ${b}`);
   const f1=raw.prepare('SELECT COALESCE(SUM(montant_millimes),0) s FROM frais').get().s,f2=(await pg.prepare('SELECT COALESCE(SUM(montant_millimes),0) s FROM frais').get()).s;
   if(f1!==f2)throw new Error(`Total des frais différent : ${f1} ≠ ${f2}`);
   rapport.totalPaiements=b;
   if(simulation)throw Object.assign(new Error('SIMULATION'),{rapport});
  })();
  log('Tables copiées :');for(const r of rapport)log('  ',r.table.padEnd(20),r.source,'→',r.cible);
  return{ok:true,sauvegarde:copie,rapport}
 }catch(e){if(e.message==='SIMULATION'){log('SIMULATION réussie : tous les contrôles passent, rien n\'a été écrit.');return{ok:true,simulation:true,sauvegarde:copie,rapport:e.rapport}}throw e}
 finally{await pg.close();await sdb.close();for(const s of['','-wal','-shm'])try{fs.unlinkSync(travail+s)}catch{}}}
module.exports={migrerSqliteVersPg};
if(require.main===module)(async()=>{
 try{
  const source=arg('source')||process.env.DB_FILE||path.join(__dirname,'../data/school.db'),cible=arg('cible')||process.env.DEFAULT_ECOLE_DATABASE_URL;
  const r=await migrerSqliteVersPg({source,cible,simulation:!!arg('simulation')});
  const slug=arg('basculer');
  if(slug&&slug!==true&&!r.simulation){ // bascule explicite dans PlatformDB (l'ancienne base SQLite reste intacte)
   const{Tenants,openPlatform}=require('../src/plateforme/tenants'),{encrypt}=require('../src/lib/secret'),p=await openPlatform(),t=new Tenants(p);
   const e=await t.find(slug);if(!e)throw new Error('École inconnue dans PlatformDB : '+slug);
   await p.prepare("UPDATE ecoles SET db_driver='pg',db_ref=? WHERE slug=?").run(encrypt(cible),slug);await t.audit(null,'basculer_vers_pg',slug,{sauvegarde:r.sauvegarde});await p.close();
   console.log(`École « ${slug} » basculée sur PostgreSQL. L'ancienne base SQLite reste intacte pour un retour arrière.`)}
  console.log(r.simulation?'Terminé (simulation).':'Migration terminée avec succès.');
 }catch(e){console.error('MIGRATION ÉCHOUÉE (aucune donnée de la base source n\'a été modifiée) :',e.message);process.exit(1)}})();
