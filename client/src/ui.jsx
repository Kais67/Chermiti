import {useEffect,useState,createContext,useContext} from 'react';import {api} from './api';
export const Ctx=createContext({});export const useApp=()=>useContext(Ctx);
export const tnd=m=>(m/1000).toFixed(3)+' TND';export const jours=['','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
export const fdate=d=>d?new Date(d.includes('T')||d.includes(' ')?d.replace(' ','T'):d+'T00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'—';
export function useLoad(path,deps=[]){const[d,setD]=useState(null),[e,setE]=useState('');const load=()=>path?api(path).then(x=>{setD(x);setE('')}).catch(x=>setE(x.message)):null;useEffect(()=>{load()},[path,...deps]);return[d,load,e]}
export const Msg=({m})=>m?<p role="alert" className={m.ok?'note ok':'note err'}>{m.t}</p>:null;
export const Vide=({t})=><div className="vide"><svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><path d="M10 14h38l6 6v30H10z" fill="none" stroke="currentColor" strokeWidth="2.500"/><path d="M18 26h28M18 34h28M18 42h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 5"/></svg><p>{t||'Rien à afficher pour le moment.'}</p></div>;
export const Page=({titre,children,sous})=><section className="page"><h1>{titre}</h1>{sous&&<p className="sous">{sous}</p>}{children}</section>;

export function Resource({titre,path,fields,columns,canWrite,noEdit,noDelete,actions,toolbar,defaults={},pageSize=10}){
 const[rows,load,err]=useLoad(path);const[form,setForm]=useState(null),[msg,setMsg]=useState(null),[q,setQ]=useState(''),[pg,setPg]=useState(0),[refs,setRefs]=useState({});
 useEffect(()=>{fields.filter(f=>f.ref).forEach(f=>api(f.ref.path).then(d=>setRefs(r=>({...r,[f.k]:d}))).catch(()=>{}))},[]);
 const lab=(f,v)=>{if(v===null||v===undefined||v==='')return '—';if(f.ref){const x=(refs[f.k]||[]).find(r=>r.id===v);return x?f.ref.label(x):v}if(f.options){const o=f.options.find(o=>String(o.v)===String(v));return o?o.t:v}return String(v)};
 const cols=(columns||fields.map(f=>f.k)).map(c=>typeof c==='string'?{f:fields.find(f=>f.k===c),label:fields.find(f=>f.k===c)?.label,render:r=>lab(fields.find(f=>f.k===c),r[c]),text:r=>lab(fields.find(f=>f.k===c),r[c])}:c);
 const list=(rows||[]).filter(r=>!q||cols.map(c=>c.text?c.text(r):'').join(' ').toLowerCase().includes(q.toLowerCase()));const pages=Math.max(1,Math.ceil(list.length/pageSize));const vis=list.slice(pg*pageSize,(pg+1)*pageSize);
 const ouvrir=r=>{setMsg(null);setForm({id:r?.id,v:r?{...r}:{...defaults}})};
 const submit=async e=>{e.preventDefault();const body={};for(const f of fields){if(form.id&&f.createOnly)continue;let v=form.v[f.k];if(v===''||v===undefined||v===null){if(f.ref&&!f.required)body[f.k]=null;else if(f.type==='number'&&!f.required)continue;continue}
  body[f.k]=(f.ref||f.type==='number'||f.num)?Number(v):v}
  try{await api(form.id?`${path}/${form.id}`:path,{method:form.id?'PUT':'POST',body});setForm(null);setMsg({ok:1,t:'Enregistré.'});load()}catch(x){setMsg({t:x.message})}};
 const suppr=async r=>{if(!confirm('Confirmer la suppression ?'))return;try{await api(`${path}/${r.id}`,{method:'DELETE'});setMsg({ok:1,t:'Supprimé.'});load()}catch(x){setMsg({t:x.message})}};
 return<Page titre={titre}><div className="barre"><input type="search" aria-label="Rechercher" placeholder="Rechercher…" value={q} onChange={e=>{setQ(e.target.value);setPg(0)}}/>{toolbar&&toolbar(load,setMsg)}{canWrite&&<button className="btn" onClick={()=>ouvrir(null)}>+ Ajouter</button>}</div>
  <Msg m={msg||(err&&{t:err})}/>
  {form&&<form className="carte form" onSubmit={submit}><h2>{form.id?'Modifier':'Nouveau'}</h2><div className="grille">{fields.filter(f=>!(form.id&&f.createOnly)).map(f=><label key={f.k}><span>{f.label}{f.required!==false&&!f.ref&&' *'}</span>
   {f.ref?<select value={form.v[f.k]??''} onChange={e=>setForm({...form,v:{...form.v,[f.k]:e.target.value}})}><option value="">— choisir —</option>{(refs[f.k]||[]).map(r=><option key={r.id} value={r.id}>{f.ref.label(r)}</option>)}</select>
   :f.options?<select value={form.v[f.k]??''} onChange={e=>setForm({...form,v:{...form.v,[f.k]:e.target.value}})}><option value="">— choisir —</option>{f.options.map(o=><option key={o.v} value={o.v}>{o.t}</option>)}</select>
   :f.type==='textarea'?<textarea rows="3" value={form.v[f.k]??''} onChange={e=>setForm({...form,v:{...form.v,[f.k]:e.target.value}})}/>
   :<input type={f.type||'text'} step={f.step} value={form.v[f.k]??''} onChange={e=>setForm({...form,v:{...form.v,[f.k]:e.target.value}})}/>}</label>)}</div>
   <div className="rang"><button className="btn">Enregistrer</button><button type="button" className="btn clair" onClick={()=>setForm(null)}>Annuler</button></div></form>}
  {rows&&(list.length?<div className="tablewrap"><table><thead><tr>{cols.map((c,i)=><th key={i}>{c.label}</th>)}<th></th></tr></thead><tbody>{vis.map(r=><tr key={r.id}>{cols.map((c,i)=><td key={i} data-l={c.label}>{c.render(r)}</td>)}
   <td className="act">{actions&&actions(r,load,setMsg)}{canWrite&&!noEdit&&<button className="lien" onClick={()=>ouvrir(r)}>Modifier</button>}{canWrite&&!noDelete&&<button className="lien danger" onClick={()=>suppr(r)}>Supprimer</button>}</td></tr>)}</tbody></table></div>:<Vide/>)}
  {pages>1&&<div className="rang pager"><button className="btn clair" disabled={pg===0} onClick={()=>setPg(pg-1)}>Précédent</button><span>Page {pg+1} / {pages}</span><button className="btn clair" disabled={pg>=pages-1} onClick={()=>setPg(pg+1)}>Suivant</button></div>}</Page>}

export function Photo({id,nom,v}){const[u,setU]=useState(null);
 useEffect(()=>{let url;setU(null);if(!v)return;fetch('/api/eleves/'+id+'/photo',{headers:{Authorization:'Bearer '+localStorage.getItem('token')}}).then(r=>r.ok?r.blob():null).then(b=>{if(b){url=URL.createObjectURL(b);setU(url)}}).catch(()=>{});return()=>{if(url)URL.revokeObjectURL(url)}},[id,v]);
 return u?<img src={u} alt={'Photo de '+nom} width="36" height="36" style={{borderRadius:'50%',objectFit:'cover'}}/>:<span className="pastille" aria-hidden="true">{(nom||'?')[0]}</span>}

export const ICO={livre:'📖',crayon:'✏️',calcul:'🔢',science:'🔬',croissant:'🌙',globe:'🌍',sport:'⚽',musique:'🎵',art:'🎨',etoile:'⭐'};
export const MODES={especes:'💵 Espèces',virement:'🏦 Virement',mobile_money:'📱 Mobile money',carte_en_ligne:'💳 En ligne'};
export const modeLabel=m=>MODES[m]||m;
export const Chip=({nom,couleur,icone})=><span className="matiere" style={{'--c':couleur||'#6b7280'}}>{ICO[icone]||'⭐'} {nom}</span>;
