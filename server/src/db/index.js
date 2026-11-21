// Adaptateur de base de données asynchrone : SQLite (tests locaux / démonstration) ou PostgreSQL (production).
// API commune : db.prepare(sql).get|all|run(...params), db.exec(sql), db.transaction(fn)(...args), db.close()
const fs=require('fs'),path=require('path'),{AsyncLocalStorage}=require('async_hooks');

// ---------- SQLite ----------
function sqliteDriver(file){
 const Database=require('./sqlite');
 if(file!==':memory:')fs.mkdirSync(path.dirname(file),{recursive:true});
 const raw=new Database(file);raw.pragma('foreign_keys = ON');raw.pragma('journal_mode = WAL');
 const als=new AsyncLocalStorage();let tx=null;
 // Une transaction à la fois ; les requêtes extérieures attendent sa fin (une seule connexion SQLite).
 const idle=async()=>{while(tx&&!als.getStore())await tx.done};
 const flat=p=>p.length===1&&Array.isArray(p[0])?p[0]:p;
 return{kind:'sqlite',raw,
  async get(sql,p){await idle();return raw.prepare(sql).get(...flat(p))},
  async all(sql,p){await idle();return raw.prepare(sql).all(...flat(p))},
  async run(sql,p){await idle();const r=raw.prepare(sql).run(...flat(p));return{changes:r.changes,lastInsertRowid:Number(r.lastInsertRowid)}},
  async exec(sql){await idle();raw.exec(sql)},
  async tx(fn){
   if(als.getStore())return fn();
   await idle();let release;const t={done:new Promise(r=>release=r)};tx=t;
   try{raw.exec('BEGIN IMMEDIATE');let out;try{out=await als.run({t},fn);raw.exec('COMMIT')}catch(e){try{raw.exec('ROLLBACK')}catch{}throw e}return out}
   finally{tx=null;release()}},
  async close(){raw.close()}}}

// ---------- PostgreSQL ----------
const NOW_TXT="to_char(timezone('utc',now()),'YYYY-MM-DD HH24:MI:SS')";
function toPg(sql){
 let s=sql,ignore=false;
 s=s.replace(/datetime\('now'\s*,\s*'([^']*)'\)/gi,"to_char(timezone('utc',now())+interval '$1','YYYY-MM-DD HH24:MI:SS')").replace(/datetime\('now'\s*,\s*\?\)/gi,`to_char(timezone('utc',now())+(?)::interval,'YYYY-MM-DD HH24:MI:SS')`)
  .replace(/datetime\('now'\)/gi,NOW_TXT).replace(/date\('now'\)/gi,"to_char(timezone('utc',now()),'YYYY-MM-DD')")
  .replace(/\bchar\((\d+)\)/gi,'chr($1)').replace(/INSERT\s+OR\s+IGNORE\s+INTO/i,()=>{ignore=true;return 'INSERT INTO'});
 let n=0,out='',q=null;
 for(const c of s){if(q){out+=c;if(c===q)q=null}else if(c==="'"||c==='"'){q=c;out+=c}else if(c==='?')out+='$'+(++n);else out+=c}
 out=out.replace(/;\s*$/,'');
 return{sql:out,ignore}}
function pgDriver(url,{max=10}={}){
 const{Pool,types}=require('pg');
 types.setTypeParser(20,v=>parseInt(v,10));types.setTypeParser(1700,v=>parseFloat(v));
 const pool=new Pool({connectionString:url,max:Math.max(3,max),ssl:process.env.PGSSL==='true'?{rejectUnauthorized:false}:undefined});
 pool.on('error',e=>console.error('[pg] erreur de connexion inactive :',e.message));
 const als=new AsyncLocalStorage(),hasId=new Map();
 const cl=()=>(als.getStore()||{}).client||pool;
 const flat=p=>p.length===1&&Array.isArray(p[0])?p[0]:p;
 const norm=v=>v===undefined?null:typeof v==='boolean'?+v:v;
 const query=(sql,p)=>cl().query(sql,flat(p).map(norm));
 async function idCol(table){if(!hasId.has(table)){const r=await cl().query("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND column_name='id'",[table.toLowerCase()]);hasId.set(table,r.rowCount>0)}return hasId.get(table)}
 return{kind:'pg',pool,
  async get(sql,p){return(await query(toPg(sql).sql,p)).rows[0]},
  async all(sql,p){return(await query(toPg(sql).sql,p)).rows},
  async run(sql,p){
   const t=toPg(sql);let q=t.sql;const m=/^\s*INSERT\s+INTO\s+"?(\w+)"?/i.exec(q);let ret=false;
   if(t.ignore)q+=' ON CONFLICT DO NOTHING';
   if(m&&!/\bRETURNING\b/i.test(q)&&await idCol(m[1])){q+=' RETURNING id';ret=true}
   const r=await query(q,p);return{changes:r.rowCount,lastInsertRowid:ret&&r.rows[0]?Number(r.rows[0].id):undefined}},
  async exec(sql){await cl().query(sql)},
  async tx(fn){
   if(als.getStore())return fn();
   const client=await pool.connect();
   try{await client.query('BEGIN');const out=await als.run({client},fn);await client.query('COMMIT');return out}
   catch(e){try{await client.query('ROLLBACK')}catch{}throw e}finally{client.release()}},
  async close(){await pool.end()}}}

// ---------- API commune ----------
function wrap(d){
 const db={driver:d.kind,_d:d,
  prepare:sql=>({get:(...p)=>d.get(sql,p),all:(...p)=>d.all(sql,p),run:(...p)=>d.run(sql,p)}),
  exec:sql=>d.exec(sql),
  transaction:fn=>(...a)=>d.tx(()=>fn(...a)),
  close:()=>d.close()};
 return db}
const isPg=t=>/^postgres(ql)?:\/\//i.test(t||'');
// open(cible) : « :memory: » ou chemin SQLite, ou URL postgres://… ; sans argument : DATABASE_URL puis DB_FILE
async function open(target,opts={}){
 target=target||process.env.DB_FILE||path.join(__dirname,'../../data/school.db');
 const db=wrap(isPg(target)?pgDriver(target,opts):sqliteDriver(target));
 await migrate(db,opts.set);return db}
async function migrate(db,set='ecole'){
 const dir=set==='plateforme'?path.join(__dirname,'../plateforme/migrations',db.driver==='pg'?'pg':'sqlite'):path.join(__dirname,'migrations',db.driver==='pg'?'pg':'sqlite');
 const files=fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
 const run=async()=>{
  await db.exec(db.driver==='pg'?`CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT(to_char(timezone('utc',now()),'YYYY-MM-DD HH24:MI:SS')))`
   :"CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT(datetime('now')))");
  for(const f of files){
   if(await db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(f))continue;
   const sql=fs.readFileSync(path.join(dir,f),'utf8');
   if(db.driver==='sqlite'&&/^--\s*no-transaction/.test(sql)){ // reconstruction de table : clés étrangères désactivées hors transaction, puis vérifiées
    await db.exec('PRAGMA foreign_keys=OFF');
    try{await db.exec(sql);const bad=await db._d.all('PRAGMA foreign_key_check',[]);if(bad.length)throw new Error('Migration '+f+' : intégrité référentielle rompue ('+bad.length+' lignes)');await db.prepare('INSERT INTO schema_migrations(version) VALUES(?)').run(f)}
    catch(e){try{await db.exec('ROLLBACK')}catch{}throw e}finally{await db.exec('PRAGMA foreign_keys=ON')}continue}
   await db.transaction(async()=>{await db.exec(sql);await db.prepare('INSERT INTO schema_migrations(version) VALUES(?)').run(f)})()}};
 if(db.driver==='pg'){ // verrou consultatif : un seul processus migre à la fois
  const c=await db._d.pool.connect();try{await c.query('SELECT pg_advisory_lock(727001)');await run()}finally{try{await c.query('SELECT pg_advisory_unlock(727001)')}finally{c.release()}}
 }else await run()}
module.exports={open,migrate,isPg,toPg};
