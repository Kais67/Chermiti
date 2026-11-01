require('dotenv').config({path:require('path').join(__dirname,'../../.env')});
const path=require('path'),fs=require('fs'),express=require('express');
if(!process.env.JWT_SECRET){console.error('JWT_SECRET manquant : copiez .env.example en .env et définissez une valeur.');process.exit(1)}
const{open}=require('./db'),db=open(),app=require('./app')(db),dist=path.join(__dirname,'../../client/dist');
// Mode démonstration (hébergement gratuit sans disque persistant) : recrée les données fictives si la base est vide
if(process.env.ALLOW_DEMO_SEED==='true'&&db.prepare('SELECT COUNT(*) n FROM users').get().n===0)require('child_process').execFileSync(process.execPath,[path.join(__dirname,'../scripts/seed.js')],{stdio:'inherit',env:process.env});
if(fs.existsSync(dist)){app.use(express.static(dist));app.use((q,r,n)=>q.method==='GET'&&!q.path.startsWith('/api')&&!/\.[a-z0-9]+$/i.test(q.path)?r.sendFile(path.join(dist,'index.html')):n())}
app.listen(process.env.PORT||3000,()=>console.log('École Abou El Kacem Chebbi : http://localhost:'+(process.env.PORT||3000)));

if(process.env.RELANCES_AUTO==='true'){const rel=require('./services/relances'),jours=+process.env.RELANCES_JOURS||7;const run=()=>{try{console.log('Relances automatiques envoyées :',rel.lancer(db,{jours}))}catch(e){console.error(e)}};setTimeout(run,60000);setInterval(run,24*3600*1000)}
