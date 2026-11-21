// Sauvegarde de PlatformDB et de chaque école. Usage : npm run backup [-- --ecole slug]
// SQLite : copie cohérente ; PostgreSQL : pg_dump (format custom, nécessite le client PostgreSQL). Conservation : 30 jours.
require('dotenv').config({path:require('path').join(__dirname,'../../.env')});
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const arg=n=>{const i=process.argv.indexOf('--'+n);return i<0?undefined:process.argv[i+1]};
const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
async function sauver(nom,driver,ref,root){
 const dir=path.join(root,nom);fs.mkdirSync(dir,{recursive:true});
 if(driver==='sqlite'){const{open}=require('../src/db'),db=await open(ref,{set:nom==='plateforme'?'plateforme':'ecole'}),f=path.join(dir,`${nom}-${stamp()}.db`);await db._d.raw.backup(f);await db.close();return f}
 const f=path.join(dir,`${nom}-${stamp()}.dump`),r=spawnSync('pg_dump',['--format=custom','--no-owner','--file',f,ref],{encoding:'utf8'});
 if(r.error&&r.error.code==='ENOENT')throw new Error('pg_dump introuvable : installez le client PostgreSQL (postgresql-client)');
 if(r.status!==0)throw new Error('pg_dump a échoué : '+(r.stderr||'').trim());return f}
function purge(root){for(const d of fs.readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()))for(const x of fs.readdirSync(path.join(root,d.name))){const p=path.join(root,d.name,x);if(Date.now()-fs.statSync(p).mtimeMs>30*864e5){fs.unlinkSync(p);console.log('Ancienne sauvegarde supprimée :',x)}}}
(async()=>{
 const{Tenants,openPlatform}=require('../src/plateforme/tenants'),{decrypt}=require('../src/lib/secret'),p=await openPlatform(),t=new Tenants(p);
 const root=path.join(process.env.BACKUP_DIR||path.join(__dirname,'../data/backups'));fs.mkdirSync(root,{recursive:true});let ko=0;
 try{
  const only=arg('ecole'),list=(await p.prepare('SELECT * FROM ecoles').all()).filter(e=>!only||e.slug===only);
  if(only&&!list.length)throw new Error('École inconnue : '+only);
  if(!only){const pfRef=process.env.PLATFORM_DATABASE_URL||process.env.PLATFORM_DB_FILE||(p.driver==='sqlite'?p._d.raw.name:null);
   try{console.log('Sauvegarde PlatformDB :',await sauver('plateforme',p.driver,pfRef,root))}catch(e){ko++;console.error('ÉCHEC PlatformDB :',e.message)}}
  for(const e of list){try{console.log('Sauvegarde',e.slug,':',await sauver(e.slug,e.db_driver,decrypt(e.db_ref),root))}catch(x){ko++;console.error('ÉCHEC',e.slug,':',x.message)}}
  purge(root);
 }finally{await p.close()}
 process.exit(ko?1:0)})().catch(e=>{console.error(e.message);process.exit(1)});
