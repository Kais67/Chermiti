import {tr_serveur} from './i18n';
// Application Android : le client est embarqué dans l'appli et appelle le serveur de la plateforme (VITE_API_URL, HTTPS obligatoire).
const BASE=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'')+'/api';
const T=()=>localStorage.getItem('token');
export async function api(path,{method='GET',body,form}={}){const h={};if(T())h.Authorization='Bearer '+T();const ec=localStorage.getItem('ecole');if(ec)h['X-Ecole']=ec;let b;
 if(form)b=form;else if(body!==undefined){h['Content-Type']='application/json';b=JSON.stringify(body)}
 const r=await fetch(BASE+path,{method,headers:h,body:b});
 if(r.status===401&&T()&&!path.startsWith('/auth')){localStorage.clear();location.reload()}
 const j=(r.headers.get('content-type')||'').includes('json')?await r.json():null;
 if(!r.ok){const e=new Error(tr_serveur(j&&j.erreur||'Erreur '+r.status)+(j&&j.details?' : '+j.details.map(d=>(d.path||[]).join('.')+' '+d.message).join(' ; '):''));e.code=j&&j.code;e.status=r.status;throw e}return j}
export async function download(path,name){const ec=localStorage.getItem('ecole');const r=await fetch(BASE+path,{headers:{Authorization:'Bearer '+T(),...(ec?{'X-Ecole':ec}:{})}});if(!r.ok)throw new Error(tr_serveur('Téléchargement impossible'));
 const u=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
