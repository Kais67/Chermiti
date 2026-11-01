// Usage : node scripts/restore.js data/backups/school-XXXX.db   (arrêtez le serveur avant)
const fs=require('fs'),path=require('path'),src=process.argv[2],dst=path.join(__dirname,'../data/school.db');
if(!src||!fs.existsSync(src)){console.error('Fichier de sauvegarde introuvable.');process.exit(1)}
if(fs.existsSync(dst))fs.copyFileSync(dst,dst+'.avant-restauration');
for(const s of['-wal','-shm'])if(fs.existsSync(dst+s))fs.unlinkSync(dst+s);
fs.copyFileSync(src,dst);console.log('Base restaurée. Copie de l\'ancienne base : school.db.avant-restauration');
