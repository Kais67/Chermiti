// SQLite sans compilation obligatoire : utilise better-sqlite3 s'il est installé (dépendance optionnelle), sinon le module intégré à Node (node:sqlite).
// API commune : new Database(fichier,{readonly}) → prepare().get/all/run, exec, pragma, backup, close, name.
let Native=null;
// better-sqlite3 se charge « paresseusement » : require() réussit même si le binaire compilé manque ou ne correspond pas à votre version de Node.
// On l'essaie donc réellement (base en mémoire) et on bascule sur node:sqlite au moindre échec.
if(!process.env.FORCE_NODE_SQLITE){try{const D=require('better-sqlite3');new D(':memory:').close();Native=D}catch{}}
if(Native)module.exports=Native;
else{
 const{DatabaseSync}=require('node:sqlite');
 class Database{
  constructor(file,opt={}){this.name=file;this.db=new DatabaseSync(file,{readOnly:!!opt.readonly})}
  prepare(sql){const s=this.db.prepare(sql),n=p=>p.map(v=>v===undefined?null:typeof v==='boolean'?+v:v); // undefined → NULL, comme better-sqlite3
   return{get:(...p)=>s.get(...n(p)),all:(...p)=>s.all(...n(p)),run:(...p)=>s.run(...n(p))}}
  exec(sql){this.db.exec(sql);return this}
  pragma(txt,opt={}){const r=this.db.prepare('PRAGMA '+txt).all();return opt.simple?(r[0]?Object.values(r[0])[0]:undefined):r}
  async backup(dest){this.db.exec(`VACUUM INTO '${String(dest).replace(/'/g,"''")}'`)}
  close(){this.db.close()}}
 module.exports=Database}
