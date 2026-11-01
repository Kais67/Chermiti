const Database=require('better-sqlite3'),fs=require('fs'),path=require('path');
function open(file=process.env.DB_FILE||path.join(__dirname,'../../data/school.db')){
 if(file!==':memory:')fs.mkdirSync(path.dirname(file),{recursive:true});
 const db=new Database(file);db.pragma('foreign_keys = ON');db.pragma('journal_mode = WAL');migrate(db);return db}
function migrate(db){
 db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT(datetime(\'now\')))');
 const dir=path.join(__dirname,'migrations');
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()){
  if(db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(f))continue;
  db.transaction(()=>{db.exec(fs.readFileSync(path.join(dir,f),'utf8'));db.prepare('INSERT INTO schema_migrations(version) VALUES(?)').run(f)})()}}
module.exports={open,migrate};
