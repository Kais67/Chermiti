// Gestionnaire d'écoles : PlatformDB (registre) + une base de données indépendante par école.
const path=require('path'),fs=require('fs'),bcrypt=require('bcryptjs');
const{open,isPg}=require('../db'),{encrypt,decrypt}=require('../lib/secret');
const SLUG=/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const DATA=process.env.DATA_DIR||(process.env.DB_FILE&&process.env.DB_FILE!==':memory:'?path.dirname(process.env.DB_FILE):path.join(__dirname,'../../data'));
const UPLOADS=process.env.UPLOADS_DIR?path.resolve(process.env.UPLOADS_DIR):path.join(__dirname,'../../uploads');
const err=(s,m,code)=>Object.assign(new Error(m),{status:s,code});
const anneeCourante=()=>{const d=new Date(),y=d.getFullYear();return d.getMonth()>=7?`${y}-${y+1}`:`${y-1}-${y}`};

async function openPlatform(target){
 target=target||process.env.PLATFORM_DATABASE_URL||process.env.PLATFORM_DB_FILE||path.join(DATA,'platform.db');
 const db=await open(target,{set:'plateforme',max:5});
 if(db.driver==='sqlite'&&process.env.NODE_ENV==='production')console.warn('⚠ MODE DÉMONSTRATION : PlatformDB en SQLite. Production = PostgreSQL (PLATFORM_DATABASE_URL), voir docs/architecture_multi_ecoles.md');
 return db}

// Remplace le nom de base d'une URL PostgreSQL (accepte aussi les sockets Cloud SQL : postgres://u:p@/base?host=/cloudsql/projet:region:instance)
const avecBase=(url,nom)=>{const m=/^(postgres(?:ql)?:\/\/[^/?]*)(?:\/[^?]*)?(\?.*)?$/.exec(url);if(!m)throw new Error('URL PostgreSQL invalide');return`${m[1]}/${nom}${m[2]||''}`};
// Crée une base PostgreSQL vide pour une école (nécessite un rôle CREATEDB : PG_ADMIN_URL)
async function createPgDatabase(adminUrl,name){
 const{Client}=require('pg'),c=new Client({connectionString:adminUrl});await c.connect();
 try{
  if((await c.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)throw err(409,`La base « ${name} » existe déjà`,'BASE_EXISTANTE');
  try{await c.query(`CREATE DATABASE "${name}"`)}catch(e){throw err(500,`Création de la base impossible (droit CREATEDB requis sur PG_ADMIN_URL) : ${e.message}`,'CREATEDB_REFUSE')}
 }finally{await c.end()}
 return avecBase(adminUrl,name)}

class Tenants{
 constructor(platform,{max=Number(process.env.TENANTS_CACHE)||25}={}){this.p=platform;this.cache=new Map();this.pending=new Map();this.max=max}
 list(){return this.p.prepare('SELECT id,slug,nom,statut,db_driver,langue_defaut,plan,fin_abonnement,contact_nom,contact_email,created_at FROM ecoles ORDER BY id').all()}
 find(slug){return this.p.prepare('SELECT * FROM ecoles WHERE slug=?').get(slug)}
 async get(slug){
  const hit=this.cache.get(slug);if(hit){hit.last=Date.now();return hit}
  if(this.pending.has(slug))return this.pending.get(slug);
  const pr=(async()=>{const row=await this.find(slug);if(!row)return null;
   const db=await open(decrypt(row.db_ref),{max:Number(process.env.TENANT_POOL_MAX)||5});
   db.uploadsDir=row.uploads_dir?path.join(UPLOADS,row.uploads_dir):UPLOADS;fs.mkdirSync(db.uploadsDir,{recursive:true});db.ecole=row.slug;db.ecoleNom=row.nom;
   const e={row,db,app:require('../app')(db),last:Date.now()};this.cache.set(slug,e);await this.evict();return e})().finally(()=>this.pending.delete(slug));
  this.pending.set(slug,pr);return pr}
 async evict(){while(this.cache.size>this.max){const[k,v]=[...this.cache].sort((a,b)=>a[1].last-b[1].last)[0];this.cache.delete(k);try{await v.db.close()}catch{}}}
 async invalidate(slug){const e=this.cache.get(slug);this.cache.delete(slug);if(e)try{await e.db.close()}catch{}}
 async closeAll(){for(const s of[...this.cache.keys()])await this.invalidate(s)}
 async audit(adminId,action,slug,details){await this.p.prepare('INSERT INTO audit_plateforme(super_admin_id,action,ecole_slug,details) VALUES(?,?,?,?)').run(adminId||null,action,slug||null,details?JSON.stringify(details):null)}
 // Création d'une école : base indépendante + migrations + premier administrateur
 async provision({slug,nom,langue='fr',databaseUrl,admin,superAdminId,plan='essai',finAbonnement=null,contact={}}){
  if(!['essai','standard','premium'].includes(plan))throw err(400,'Plan invalide');
  if(finAbonnement&&!/^\d{4}-\d{2}-\d{2}$/.test(finAbonnement))throw err(400,'Date de fin d\'abonnement invalide (AAAA-MM-JJ)');
  if(!SLUG.test(slug||''))throw err(400,'Identifiant invalide : 3 à 32 caractères (minuscules, chiffres, tirets)','SLUG_INVALIDE');
  if(!nom||!nom.trim())throw err(400,"Nom de l'école requis");
  if(!['fr','ar','en'].includes(langue))throw err(400,'Langue invalide');
  if(!admin||!/^\S+@\S+\.\S+$/.test(admin.email||'')||(admin.password||'').length<10)throw err(400,"Administrateur invalide (e-mail valide, mot de passe de 10 caractères minimum)");
  if(await this.find(slug))throw err(409,'Cet identifiant est déjà utilisé','SLUG_EXISTANT');
  let driver,ref;
  if(databaseUrl){if(!isPg(databaseUrl))throw err(400,'databaseUrl doit être une URL PostgreSQL');driver='pg';ref=databaseUrl}
  else if(this.p.driver==='pg'){driver='pg';ref=await createPgDatabase(process.env.PG_ADMIN_URL||process.env.PLATFORM_DATABASE_URL,'ecole_'+slug.replace(/-/g,'_'))}
  else{driver='sqlite';ref=path.join(DATA,'ecoles',slug+'.db')}
  const db=await open(ref,{max:2});
  try{
   if((await db.prepare('SELECT COUNT(*) n FROM users').get()).n>0)throw err(409,'Cette base contient déjà des données : utilisez la migration','BASE_NON_VIDE');
   await db.transaction(async()=>{
    await db.prepare('INSERT INTO users(email,password_hash,nom,role) VALUES(?,?,?,?)').run(admin.email.trim(),await bcrypt.hash(admin.password,12),admin.nom||'Direction','admin');
    await db.prepare('INSERT INTO annees_scolaires(libelle,active) VALUES(?,1)').run(anneeCourante())})()
  }finally{await db.close()}
  await this.p.prepare('INSERT INTO ecoles(slug,nom,db_driver,db_ref,langue_defaut,uploads_dir,plan,fin_abonnement,contact_nom,contact_email) VALUES(?,?,?,?,?,?,?,?,?,?)').run(slug,nom.trim(),driver,driver==='pg'?encrypt(ref):ref,langue,slug,plan,finAbonnement,contact.nom||null,contact.email||null);
  await this.audit(superAdminId,'creer_ecole',slug,{nom,driver});
  return{slug,nom:nom.trim(),driver}}
 // Enregistre l'école historique (mono-école) sans toucher à ses données
 async ensureDefault(){
  if((await this.list()).length)return null;
  const file=process.env.DB_FILE||path.join(DATA,'school.db');
  if(!(fs.existsSync(file)||process.env.ALLOW_DEMO_SEED==='true'||process.env.DEFAULT_ECOLE_DATABASE_URL))return null;
  const slug=process.env.DEFAULT_ECOLE_SLUG||'abou-el-kacem-chebbi',url=process.env.DEFAULT_ECOLE_DATABASE_URL,driver=url?'pg':'sqlite';
  await this.p.prepare('INSERT INTO ecoles(slug,nom,db_driver,db_ref,langue_defaut,uploads_dir) VALUES(?,?,?,?,?,?)').run(slug,process.env.DEFAULT_ECOLE_NOM||'École Abou El Kacem Chebbi',driver,driver==='pg'?encrypt(url):file,'fr','');
  await this.audit(null,'enregistrer_ecole_existante',slug,{driver});return slug}
}
module.exports={Tenants,openPlatform,SLUG,createPgDatabase,anneeCourante,avecBase};
