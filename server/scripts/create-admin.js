require('dotenv').config({path:require('path').join(__dirname,'../../.env')});
const bcrypt=require('bcryptjs'),readline=require('readline'),{open}=require('../src/db'),db=open();
const ask=q=>new Promise(r=>{const i=readline.createInterface({input:process.stdin,output:process.stdout});i.question(q,a=>{i.close();r(a.trim())})});
(async()=>{const email=process.env.ADMIN_EMAIL||await ask('E-mail administrateur : '),pw=process.env.ADMIN_PASSWORD||await ask('Mot de passe (10 caractères min.) : '),nom=process.env.ADMIN_NAME||'Direction';
 if(!/^\S+@\S+\.\S+$/.test(email)||pw.length<10){console.error('E-mail invalide ou mot de passe trop court.');process.exit(1)}
 db.prepare('INSERT INTO users(email,password_hash,nom,role) VALUES(?,?,?,?)').run(email,bcrypt.hashSync(pw,12),nom,'admin');
 if(!db.prepare('SELECT 1 FROM annees_scolaires').get())db.prepare('INSERT INTO annees_scolaires(libelle,active) VALUES(?,1)').run('2026-2027');
 console.log('Administrateur créé :',email)})();
