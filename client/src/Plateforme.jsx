// Console de la plateforme SaaS (super-administrateur) : créer, modifier, suspendre les écoles clientes, abonnements, accès administrateur. Adresse : /plateforme
import{useEffect,useState}from'react';import{tt,SelecteurLangue,tr_serveur}from'./i18n';
const K='sa_token';
async function pf(path,{method='GET',body}={}){const t=sessionStorage.getItem(K);
 const r=await fetch((import.meta.env.VITE_API_URL||'')+'/api/plateforme'+path,{method,headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:body&&JSON.stringify(body)});
 const j=await r.json().catch(()=>null);if(r.status===401&&t&&!path.startsWith('/login')){sessionStorage.removeItem(K);location.reload()}
 if(!r.ok)throw new Error(tr_serveur((j&&j.erreur)||'Erreur '+r.status));return j}
const PLANS=['essai','standard','premium'];
const expire=e=>e.fin_abonnement&&e.fin_abonnement<new Date().toISOString().slice(0,10);
export default function Plateforme(){
 const[ok,setOk]=useState(!!sessionStorage.getItem(K)),[l,setL]=useState({email:'',password:''}),[m,setM]=useState(null),[liste,setListe]=useState([]),[st,setSt]=useState({}),[ed,setEd]=useState(null),[mdp,setMdp]=useState(null),
  [f,setF]=useState({slug:'',nom:'',langue_defaut:'fr',plan:'essai',fin:'',contactNom:'',contactEmail:'',email:'',password:'',adminNom:''}),[busy,setBusy]=useState(false);
 const charger=()=>pf('/ecoles').then(setListe).catch(e=>setM({t:e.message}));
 useEffect(()=>{if(ok)charger()},[ok]);
 const login=async e=>{e.preventDefault();try{const r=await pf('/login',{method:'POST',body:l});sessionStorage.setItem(K,r.token);setOk(true);setM(null)}catch(x){setM({t:x.message})}};
 const creer=async e=>{e.preventDefault();setBusy(true);try{await pf('/ecoles',{method:'POST',body:{slug:f.slug.trim().toLowerCase(),nom:f.nom,langue_defaut:f.langue_defaut,plan:f.plan,...(f.fin?{fin_abonnement:f.fin}:{}),contact:{...(f.contactNom?{nom:f.contactNom}:{}),...(f.contactEmail?{email:f.contactEmail}:{})},admin:{email:f.email,password:f.password,nom:f.adminNom||undefined}}});
   setM({ok:1,t:tt('École créée : {slug}. Son administrateur peut se connecter avec le code « {slug} ».',{slug:f.slug})});setF({...f,slug:'',nom:'',email:'',password:'',adminNom:'',contactNom:'',contactEmail:'',fin:''});charger()}catch(x){setM({t:x.message})}finally{setBusy(false)}};
 const maj=async(e,body,ok)=>{try{await pf('/ecoles/'+e.slug,{method:'PUT',body});if(ok)setM({ok:1,t:ok});setEd(null);charger()}catch(x){setM({t:x.message})}};
 const stats=async e=>{try{setSt({...st,[e.slug]:await pf(`/ecoles/${e.slug}/stats`)})}catch(x){setM({t:x.message})}};
 const reinit=async e=>{if(!window.confirm(tt("Générer un nouveau mot de passe temporaire pour l'administrateur de cette école ? L'ancien ne fonctionnera plus.")))return;try{setMdp({...(await pf(`/ecoles/${e.slug}/reinitialiser-admin`,{method:'POST',body:{}})),ecole:e.nom})}catch(x){setM({t:x.message})}};
 const ouvrir=e=>{localStorage.setItem('ecole',e.slug);window.open('/','_blank')};
 const msg=m&&<p className={'msg '+(m.ok?'ok':'err')} role={m.ok?'status':'alert'}>{m.t}</p>;
 if(!ok)return<main className="landing"><div className="carte" style={{maxWidth:420,margin:'10vh auto'}}><SelecteurLangue/><h1 style={{fontSize:'1.4rem'}}>{tt('Console de la plateforme')}</h1>
  <form onSubmit={login}><label><span>{tt('E-mail')}</span><input type="email" required value={l.email} onChange={e=>setL({...l,email:e.target.value})}/></label><label><span>{tt('Mot de passe')}</span><input type="password" required value={l.password} onChange={e=>setL({...l,password:e.target.value})}/></label>{msg}<button className="btn">{tt('Se connecter')}</button></form></div></main>;
 return<main className="landing" style={{maxWidth:1100,margin:'0 auto',padding:16}}><div className="barre-langue"><SelecteurLangue/><button className="lien" onClick={()=>{sessionStorage.removeItem(K);location.reload()}}>{tt('Déconnexion')}</button></div>
  <h1>{tt('Écoles de la plateforme')}</h1>{msg}
  {mdp&&<div className="note ok" role="status"><b>{mdp.ecole}</b> — {tt('Nouveau mot de passe temporaire pour {0} : {1} — affiché une seule fois : notez-le et transmettez-le à l\'utilisateur.{2}',{0:mdp.email,1:mdp.mot_de_passe_temporaire,2:''})} <button className="lien" onClick={()=>setMdp(null)}>{tt('Fermer')}</button></div>}
  <div className="carte"><div className="tablewrap"><table className="tableau"><thead><tr><th>{tt('Code')}</th><th>{tt('Nom')}</th><th>{tt('Plan')}</th><th>{tt("Fin d'abonnement")}</th><th>{tt('Statut')}</th><th></th></tr></thead>
   <tbody>{liste.map(e=><tr key={e.slug}><td><code>{e.slug}</code></td><td>{e.nom}<br/><small>{e.db_driver==='pg'?'PostgreSQL':'SQLite ('+tt('démonstration')+')'} · {e.langue_defaut}{e.contact_email?' · '+e.contact_email:''}</small></td><td>{tt(e.plan)}</td>
    <td>{e.fin_abonnement||'—'} {expire(e)&&<span className="pastille rouge">{tt('expiré')}</span>}</td><td>{tt(e.statut)}</td>
    <td className="act"><button className="lien" onClick={()=>ouvrir(e)}>{tt("Ouvrir l'école")}</button> <button className="lien" onClick={()=>setEd({slug:e.slug,nom:e.nom,plan:e.plan,fin_abonnement:e.fin_abonnement||'',langue_defaut:e.langue_defaut,contact_nom:e.contact_nom||'',contact_email:e.contact_email||''})}>{tt('Modifier')}</button> <button className="lien" onClick={()=>stats(e)}>{tt('Statistiques')}</button> <button className="lien" onClick={()=>reinit(e)}>{tt("Mot de passe de l'administrateur")}</button>
     {e.statut==='active'?<button className="lien danger" onClick={()=>window.confirm(tt('Suspendre cette école ? Ses utilisateurs ne pourront plus se connecter.'))&&maj(e,{statut:'suspendue'})}>{tt('Suspendre')}</button>:<button className="lien" onClick={()=>maj(e,{statut:'active'})}>{tt('Réactiver')}</button>}
     {st[e.slug]&&<small> — {tt('{u} utilisateurs, {e} élèves, {c} classes',{u:st[e.slug].utilisateurs,e:st[e.slug].eleves,c:st[e.slug].classes})}</small>}</td></tr>)}</tbody></table></div></div>
  {ed&&<form className="carte" onSubmit={x=>{x.preventDefault();maj({slug:ed.slug},{nom:ed.nom,plan:ed.plan,langue_defaut:ed.langue_defaut,fin_abonnement:ed.fin_abonnement||null,contact_nom:ed.contact_nom||null,contact_email:ed.contact_email||null},tt('Configuration enregistrée.'))}}>
   <h2>{tt('Modifier')} : <code>{ed.slug}</code></h2><div className="grille">
   <label><span>{tt('Nom')}</span><input required value={ed.nom} onChange={e=>setEd({...ed,nom:e.target.value})}/></label>
   <label><span>{tt('Plan')}</span><select value={ed.plan} onChange={e=>setEd({...ed,plan:e.target.value})}>{PLANS.map(p=><option key={p} value={p}>{tt(p)}</option>)}</select></label>
   <label><span>{tt("Fin d'abonnement")}</span><input type="date" value={ed.fin_abonnement} onChange={e=>setEd({...ed,fin_abonnement:e.target.value})}/></label>
   <label><span>{tt('Langue')}</span><select value={ed.langue_defaut} onChange={e=>setEd({...ed,langue_defaut:e.target.value})}><option value="fr">Français</option><option value="ar">العربية</option><option value="en">English</option></select></label>
   <label><span>{tt('Contact : nom')}</span><input value={ed.contact_nom} onChange={e=>setEd({...ed,contact_nom:e.target.value})}/></label>
   <label><span>{tt('Contact : e-mail')}</span><input type="email" value={ed.contact_email} onChange={e=>setEd({...ed,contact_email:e.target.value})}/></label></div>
   <div className="rang"><button className="btn">{tt('Enregistrer')}</button><button type="button" className="lien" onClick={()=>setEd(null)}>{tt('Annuler')}</button></div></form>}
  <form className="carte" onSubmit={creer}><h2>{tt('Créer une école')}</h2><div className="grille">
   <label><span>{tt("Code de l'école")}</span><input required pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]" value={f.slug} onChange={e=>setF({...f,slug:e.target.value})} placeholder="mon-ecole"/></label>
   <label><span>{tt('Nom')}</span><input required value={f.nom} onChange={e=>setF({...f,nom:e.target.value})}/></label>
   <label><span>{tt('Plan')}</span><select value={f.plan} onChange={e=>setF({...f,plan:e.target.value})}>{PLANS.map(p=><option key={p} value={p}>{tt(p)}</option>)}</select></label>
   <label><span>{tt("Fin d'abonnement")}</span><input type="date" value={f.fin} onChange={e=>setF({...f,fin:e.target.value})}/></label>
   <label><span>{tt('Langue')}</span><select value={f.langue_defaut} onChange={e=>setF({...f,langue_defaut:e.target.value})}><option value="fr">Français</option><option value="ar">العربية</option><option value="en">English</option></select></label>
   <label><span>{tt('Contact : nom')}</span><input value={f.contactNom} onChange={e=>setF({...f,contactNom:e.target.value})}/></label>
   <label><span>{tt('Contact : e-mail')}</span><input type="email" value={f.contactEmail} onChange={e=>setF({...f,contactEmail:e.target.value})}/></label>
   <label><span>{tt("Nom de l'administrateur")}</span><input value={f.adminNom} onChange={e=>setF({...f,adminNom:e.target.value})}/></label>
   <label><span>{tt("E-mail de l'administrateur")}</span><input type="email" required value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label>
   <label><span>{tt('Mot de passe (10 caractères minimum)')}</span><input type="password" minLength={10} required value={f.password} onChange={e=>setF({...f,password:e.target.value})}/></label></div>
   <button className="btn" disabled={busy}>{tt("Créer l'école")}</button></form></main>}
