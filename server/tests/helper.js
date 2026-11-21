// Base de test : SQLite en mémoire par défaut ; PostgreSQL réel si TEST_PG_URL est défini (base temporaire créée puis supprimée)
const crypto=require('crypto'),{open}=require('../src/db');
module.exports=async function mk(){
 const url=process.env.TEST_PG_URL;if(!url)return open(':memory:');
 const{Client}=require('pg'),name='t_'+crypto.randomBytes(5).toString('hex'),admin=new Client({connectionString:url});
 await admin.connect();await admin.query(`CREATE DATABASE ${name}`);
 const u=new URL(url);u.pathname='/'+name;const db=await open(u.toString());
 const close=db.close;db.close=async()=>{await close();await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await admin.end()};
 return db};
