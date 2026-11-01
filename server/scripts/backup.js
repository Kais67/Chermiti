const fs=require('fs'),path=require('path'),{open}=require('../src/db');
const dir=path.join(__dirname,'../data/backups');fs.mkdirSync(dir,{recursive:true});
const db=open(),f=path.join(dir,`school-${new Date().toISOString().replace(/[:.]/g,'-')}.db`);
db.backup(f).then(()=>{console.log('Sauvegarde créée :',f);for(const x of fs.readdirSync(dir)){const p=path.join(dir,x);if(Date.now()-fs.statSync(p).mtimeMs>30*864e5){fs.unlinkSync(p);console.log('Ancienne sauvegarde supprimée :',x)}}});
