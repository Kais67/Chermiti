// Si le binaire better-sqlite3 est absent ou cassé (installation Windows incomplète), le projet doit basculer seul sur node:sqlite.
const test=require('node:test'),assert=require('node:assert'),{spawnSync}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
test('repli automatique sur node:sqlite quand better-sqlite3 est cassé',()=>{
 const hook=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'hook-')),'hook.js');
 fs.writeFileSync(hook,"const M=require('module'),l=M._load;M._load=function(r,...a){if(r==='better-sqlite3')return class{constructor(){throw new Error('Could not locate the bindings file')}};return l.call(this,r,...a)};");
 const sc="const D=require('./src/db/sqlite');const d=new D(':memory:');d.exec('CREATE TABLE t(a)');d.prepare('INSERT INTO t VALUES(?)').run(undefined);console.log('OK',d.prepare('SELECT COUNT(*) n FROM t').get().n)";
 const r=spawnSync(process.execPath,['-r',hook,'-e',sc],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
 assert.match(r.stdout,/OK 1/,r.stderr)});
