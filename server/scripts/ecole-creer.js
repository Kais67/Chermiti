// Crée une école : base indépendante + premier administrateur. Usage :
//   node scripts/ecole-creer.js --slug mon-ecole --nom "Mon École" --admin-email a@b.tn --admin-password '…' [--langue fr|ar|en] [--database-url postgres://…]
require('dotenv').config({path:require('path').join(__dirname,'../../.env')});
const arg=n=>{const i=process.argv.indexOf('--'+n);return i<0?undefined:process.argv[i+1]};
(async()=>{const{Tenants,openPlatform}=require('../src/plateforme/tenants'),p=await openPlatform(),t=new Tenants(p);
 try{const r=await t.provision({slug:arg('slug'),nom:arg('nom'),langue:arg('langue')||'fr',databaseUrl:arg('database-url'),admin:{email:arg('admin-email'),password:arg('admin-password'),nom:arg('admin-nom')}});console.log('École créée :',r)}
 catch(e){console.error('Échec :',e.message);process.exitCode=1}finally{await p.close()}})();
