// Crée OU réinitialise (si l'e-mail existe déjà) un super-administrateur de la plateforme (gestion des écoles). Usage : SUPER_ADMIN_EMAIL=… SUPER_ADMIN_PASSWORD=… node scripts/super-admin-creer.js
require('dotenv').config({path:require('path').join(__dirname,'../../.env')});
const bcrypt=require('bcryptjs');
(async()=>{const{openPlatform}=require('../src/plateforme/tenants'),p=await openPlatform(),e=process.env.SUPER_ADMIN_EMAIL,pw=process.env.SUPER_ADMIN_PASSWORD;
 try{if(!/^\S+@\S+\.\S+$/.test(e||'')||(pw||'').length<10)throw new Error('SUPER_ADMIN_EMAIL valide et SUPER_ADMIN_PASSWORD (10 caractères min.) requis');
  const h=await bcrypt.hash(pw,12),ex=await p.prepare('SELECT id FROM super_admins WHERE lower(email)=lower(?)').get(e.trim());
  if(ex){await p.prepare('UPDATE super_admins SET password_hash=? WHERE id=?').run(h,ex.id);console.log('Mot de passe réinitialisé pour :',e)}else{await p.prepare('INSERT INTO super_admins(email,password_hash,nom) VALUES(?,?,?)').run(e.trim(),h,'Super administrateur');console.log('Super-administrateur créé :',e)}}
 catch(x){console.error('Échec :',x.message);process.exitCode=1}finally{await p.close()}})();
