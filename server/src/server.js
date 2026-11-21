require('dotenv').config({path:require('path').join(__dirname,'../../.env')});
if(!process.env.JWT_SECRET){console.error('JWT_SECRET manquant : copiez .env.example en .env et définissez une valeur.');process.exit(1)}
const{createServer}=require('./main');
(async()=>{
 const{app,tenants}=await createServer(),port=process.env.PORT||3000;
 const srv=app.listen(port,()=>console.log('Plateforme Multi-Écoles : http://localhost:'+port));
 if(process.env.RELANCES_AUTO==='true'){const rel=require('./services/relances'),jours=+process.env.RELANCES_JOURS||7;
  const run=async()=>{for(const e of(await tenants.list()).filter(x=>x.statut==='active')){try{const t=await tenants.get(e.slug);console.log('Relances automatiques',e.slug,':',await rel.lancer(t.db,{jours}))}catch(x){console.error(e.slug,x)}}};
  setTimeout(run,60000);setInterval(run,24*3600*1000)}
 const stop=async()=>{srv.close();await tenants.closeAll();await tenants.p.close();process.exit(0)};process.on('SIGTERM',stop);process.on('SIGINT',stop)
})().catch(e=>{console.error('Démarrage impossible :',e);process.exit(1)});
