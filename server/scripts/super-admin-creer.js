// Crée un super-administrateur de la plateforme (gestion des écoles). Usage : SUPER_ADMIN_EMAIL=… SUPER_ADMIN_PASSWORD=… node scripts/super-admin-creer.js
require('dotenv').config({path:require('path').join(__dirname,'../../.env')});
const bcrypt=require('bcryptjs');
(async()=>{const{openPlatform}=require('../src/plateforme/tenants'),p=await openPlatform(),e=process.env.SUPER_ADMIN_EMAIL,pw=process.env.SUPER_ADMIN_PASSWORD;
 try{if(!/^\S+@\S+\.\S+$/.test(e||'')||(pw||'').length<10)throw new Error('SUPER_ADMIN_EMAIL valide et SUPER_ADMIN_PASSWORD (10 caractères min.) requis');
  await p.prepare('INSERT INTO super_admins(email,password_hash,nom) VALUES(?,?,?)').run(e.trim(),await bcrypt.hash(pw,12),'Super administrateur');console.log('Super-administrateur créé :',e)}
 catch(x){console.error('Échec :',x.message);process.exitCode=1}finally{await p.close()}})();
