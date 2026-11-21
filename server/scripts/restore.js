// Restauration d'une école. Usage : node scripts/restore.js <slug> <fichier-de-sauvegarde>   (SQLite : arrêtez le serveur avant)
// Une sauvegarde de sécurité de l'état actuel est créée AVANT l'écrasement. Ancien usage : node scripts/restore.js <fichier.db> (restaure DB_FILE).
require('dotenv').config({path:require('path').join(__dirname,'../../.env')});
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const[a,b]=process.argv.slice(2);
(async()=>{
 if(a&&!b){const dst=process.env.DB_FILE||path.join(__dirname,'../data/school.db');if(!fs.existsSync(a))throw new Error('Fichier de sauvegarde introuvable.');
  if(fs.existsSync(dst))fs.copyFileSync(dst,dst+'.avant-restauration');for(const s of['-wal','-shm'])if(fs.existsSync(dst+s))fs.unlinkSync(dst+s);fs.copyFileSync(a,dst);return console.log("Base restaurée. Copie de l'ancienne base : "+path.basename(dst)+'.avant-restauration')}
 if(!a||!b||!fs.existsSync(b))throw new Error('Usage : node scripts/restore.js <slug> <fichier-de-sauvegarde>');
 const{Tenants,openPlatform}=require('../src/plateforme/tenants'),{decrypt}=require('../src/lib/secret'),p=await openPlatform();
 try{const e=await new Tenants(p).find(a);if(!e)throw new Error('École inconnue : '+a);const ref=decrypt(e.db_ref);
  if(e.db_driver==='sqlite'){if(fs.existsSync(ref))fs.copyFileSync(ref,ref+'.avant-restauration');for(const s of['-wal','-shm'])if(fs.existsSync(ref+s))fs.unlinkSync(ref+s);fs.copyFileSync(b,ref);console.log('École « '+a+' » restaurée. Ancienne base : '+ref+'.avant-restauration')}
  else{const sec=path.join(path.dirname(path.resolve(b)),`avant-restauration-${Date.now()}.dump`),d=spawnSync('pg_dump',['--format=custom','--no-owner','--file',sec,ref],{encoding:'utf8'});
   if(d.status!==0)throw new Error('Sauvegarde de sécurité impossible, restauration annulée : '+(d.stderr||d.error));
   const r=spawnSync('pg_restore',['--clean','--if-exists','--no-owner','--dbname',ref,b],{encoding:'utf8'});if(r.status!==0)throw new Error('pg_restore a échoué : '+r.stderr);
   console.log('École « '+a+' » restaurée. Sauvegarde de sécurité :',sec)}
 }finally{await p.close()}})().catch(e=>{console.error('Échec :',e.message);process.exit(1)});
