// Repart d'une démonstration propre (2 écoles) : met de côté (JAMAIS supprime) le dossier server/data, puis le serveur recrée les écoles A et B.
// Usage : npm run reset:demo   (arrêter le serveur avant)
const fs=require('fs'),path=require('path');
const dir=path.resolve(process.env.DATA_DIR||(process.env.DB_FILE?path.dirname(process.env.DB_FILE):path.join(__dirname,'../data')));
if(!fs.existsSync(dir)){console.log('Rien à réinitialiser :',dir);process.exit(0)}
const dest=dir+'.sauvegarde-'+new Date().toISOString().replace(/[:.]/g,'-');
fs.renameSync(dir,dest);console.log('Anciennes données conservées dans :',dest,'\nRelancez maintenant : npm run dev');
