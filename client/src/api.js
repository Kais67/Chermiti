const T=()=>localStorage.getItem('token');
export async function api(path,{method='GET',body,form}={}){const h={};if(T())h.Authorization='Bearer '+T();let b;
 if(form)b=form;else if(body!==undefined){h['Content-Type']='application/json';b=JSON.stringify(body)}
 const r=await fetch('/api'+path,{method,headers:h,body:b});
 if(r.status===401&&T()&&!path.startsWith('/auth')){localStorage.clear();location.reload()}
 const j=(r.headers.get('content-type')||'').includes('json')?await r.json():null;
 if(!r.ok)throw new Error((j&&j.erreur||'Erreur '+r.status)+(j&&j.details?' : '+j.details.map(d=>(d.path||[]).join('.')+' '+d.message).join(' ; '):''));return j}
export async function download(path,name){const r=await fetch('/api'+path,{headers:{Authorization:'Bearer '+T()}});if(!r.ok)throw new Error('Téléchargement impossible');
 const u=URL.createObjectURL(await r.blob());const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
