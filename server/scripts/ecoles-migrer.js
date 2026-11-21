// Applique les migrations de schéma à PlatformDB et à toutes les écoles actives (à lancer à chaque déploiement).
require('dotenv').config({path:require('path').join(__dirname,'../../.env')});
(async()=>{const{Tenants,openPlatform}=require('../src/plateforme/tenants'),p=await openPlatform(),t=new Tenants(p);let ko=0;
 for(const e of await t.list()){try{await t.get(e.slug);console.log('OK  ',e.slug,'('+e.db_driver+')')}catch(x){ko++;console.error('ÉCHEC',e.slug,x.message)}}
 await t.closeAll();await p.close();process.exit(ko?1:0)})();
