// Interface des paiements : passerelle (DEMO / fournisseur réel), demandes d'espèces, validation par le secrétariat, configuration des fournisseurs.
// Règle d'affichage : un paiement simulé ou de test est TOUJOURS signalé « TEST — aucun argent réel », jamais présenté comme réel.
import{useState,useEffect,useRef}from'react';import{api,download}from'./api';import{useApp,useLoad,Msg,Vide,Page,tnd,fdate}from'./ui';import{useNavigate,useParams}from'react-router-dom';import{tt}from'./i18n';

export const BadgeTest=({s})=>s?<span className="pastille test" title={tt("Paiement de test : aucun argent réel")}>{tt('TEST')}</span>:null;

export function PasserelleSimulee(){ // page /paiement/:token (DEMO) et retour de redirection d'un fournisseur (?retour=1|0)
 const{token}=useParams();const nav=useNavigate();const[s,setS]=useState(null),[res,setRes]=useState(null),[msg,setMsg]=useState(null),essais=useRef(0);
 const retour=new URLSearchParams(location.search).get('retour');
 useEffect(()=>{let stop=false;
  const lire=()=>api('/paiements-en-ligne/'+token).then(x=>{if(stop)return;setS(x);return x}).catch(e=>setMsg({t:e.message}));
  const verifier=async()=>{try{const x=await api(`/paiements-en-ligne/${token}/verifier`,{method:'POST'});if(stop)return;
    if(x.statut==='en_attente'&&essais.current++<6)setTimeout(verifier,3000);else setRes(x)}catch(e){if(!stop)setMsg({t:e.message})}};
  lire().then(x=>{if(x&&x.fournisseur!=='demo'&&retour!==null)verifier()});return()=>{stop=true}},[token]);
 const agir=async r=>{try{setRes(await api(`/paiements-en-ligne/${token}/confirmer`,{method:'POST',body:{resultat:r}}))}catch(e){setMsg({t:e.message})}};
 const simule=res?res.simule:s&&s.simule;
 return<Page titre={tt('💳 Paiement en ligne')}>
  {simule&&<div className="banniere-demo" role="note">{s&&s.fournisseur==='demo'?tt("🧪 MODE DÉMONSTRATION — aucun argent réel n'est débité et aucune carte n'est demandée."):tt("🧪 MODE TEST — le fournisseur est en environnement d'essai : aucun argent réel n'est débité.")}</div>}<Msg m={msg}/>
  {res?<div className="carte resultat">{res.statut==='paye'?<><span className="grand-ico">✅</span><h2>{res.simule?tt('Paiement de test enregistré'):tt('Paiement réussi !')}</h2>{res.simule&&<p><b>{tt("TEST — ce paiement n'a aucune valeur réelle.")}</b></p>}<p>{tt('Il vous reste à payer :')} <b>{tnd(res.solde)}</b></p><div className="rang" style={{justifyContent:'center'}}><button className="btn grand" onClick={()=>download(`/paiements/${res.paiement_id}/recu`,`recu-${res.paiement_id}.pdf`)}>{tt('📄 Télécharger mon reçu')}</button><button className="btn clair grand" onClick={()=>nav('/paiements')}>{tt('↩️ Retour aux paiements')}</button></div></>
   :<><span className="grand-ico">{res.statut==='echoue'?'❌':res.statut==='en_attente'?'⏳':'↩️'}</span><h2>{res.statut==='echoue'?tt('Le paiement a échoué'):res.statut==='en_attente'?tt("Paiement en attente de confirmation"):tt('Paiement annulé')}</h2><p>{res.statut==='en_attente'?tt("Nous n'avons pas encore reçu la confirmation de la banque. Rechargez cette page dans quelques minutes : rien n'est enregistré tant que le paiement n'est pas confirmé."):tt("Aucun montant n'a été enregistré.")}</p><button className="btn grand" onClick={()=>nav('/paiements')}>{tt('↩️ Retour aux paiements')}</button></>}</div>
  :s&&<div className="carte resultat">{s.statut==='en_attente'&&s.fournisseur==='demo'?<><p className="grandtxt">{tt('Enfant :')} <b>{s.enfant}</b></p><p>{tt('Montant à payer')}</p><b className="montant-gros">{tnd(s.montant_millimes)}</b>
     <div className="rang" style={{justifyContent:'center'}}><button className="btn grand" onClick={()=>agir('succes')}>{tt('✅ Simuler un paiement réussi')}</button><button className="btn clair grand" onClick={()=>agir('echec')}>{tt('❌ Simuler un échec')}</button><button className="lien" onClick={()=>agir('annule')}>{tt('↩️ Annuler')}</button></div>
     <p className="aide">{tt("Avec un vrai prestataire (Flouci, Konnect), cet écran est remplacé par sa page sécurisée.")}</p></>
    :s.statut==='en_attente'?<><span className="grand-ico">⏳</span><h2>{tt('Vérification du paiement…')}</h2></>
    :<><span className="grand-ico">ℹ️</span><h2>{tt('Session')} {s.statut==='paye'?tt('déjà payée'):s.statut==='expire'?tt('expirée'):tt('terminée')}</h2><button className="btn grand" onClick={()=>nav('/paiements')}>{tt('↩️ Retour aux paiements')}</button></>}</div>}</Page>}

// Parent : payer en ligne (si activé) ou demander un paiement en espèces au secrétariat
export function PayerEnLigne(){
 const[el]=useLoad('/eleves'),[cfg]=useLoad('/paiement-en-ligne/config'),[dem,loadDem]=useLoad('/paiements-especes'),[soldes,setS]=useState({}),[mt,setMt]=useState({}),[msg,setMsg]=useState(null),[four,setFour]=useState('');const nav=useNavigate();
 useEffect(()=>{if(Array.isArray(el))el.forEach(e=>api(`/eleves/${e.id}/solde`).then(s=>setS(x=>({...x,[e.id]:s.solde}))).catch(()=>{}))},[el]);
 if(!Array.isArray(el))return null;
 const montant=e=>Math.round(Number(mt[e.id]!==undefined?mt[e.id]:soldes[e.id]/1000)*1000);
 const payer=async e=>{try{const r=await api('/paiements-en-ligne',{method:'POST',body:{eleve_id:e.id,montant_millimes:montant(e),...(four?{fournisseur:four}:{})}});if(r.externe)window.location.href=r.url;else nav(r.url)}catch(x){setMsg({t:x.message})}};
 const especes=async e=>{try{const r=await api('/paiements-especes',{method:'POST',body:{eleve_id:e.id,montant_millimes:montant(e)}});setMsg({ok:1,t:tt('Demande {ref} enregistrée. Présentez-vous au secrétariat avec cette référence : le paiement sera pris en compte après validation par le secrétariat.',{ref:r.reference})});loadDem()}catch(x){setMsg({t:x.message})}};
 const annuler=async d=>{try{await api(`/paiements-especes/${d.id}/annuler`,{method:'POST',body:{}});loadDem()}catch(x){setMsg({t:x.message})}};
 const actif=cfg&&cfg.actif;
 return<div className="carte payer"><h2>{tt('💳 Payer')}</h2>
  {actif&&cfg.avertissement&&<div className="banniere-demo" role="note">🧪 {tt(cfg.avertissement)}</div>}
  <p className="aide">{tt("Choisissez le montant. Vous pouvez payer en ligne, ou demander à payer en espèces au secrétariat de l'école.")}</p><Msg m={msg}/>
  {actif&&cfg.fournisseurs.length>1&&<label className="inline"><span>{tt('Moyen de paiement en ligne')}</span><select value={four} onChange={e=>setFour(e.target.value)}><option value="">{tt('Par défaut')}</option>{cfg.fournisseurs.map(f=><option key={f.id} value={f.id}>{f.id==='demo'?tt('Démonstration (aucun argent réel)'):f.label+(f.simule?' — '+tt('TEST'):'')}</option>)}</select></label>}
  {el.map(e=>{const d=soldes[e.id];return<div key={e.id} className="payer-ligne"><div className="payer-enfant"><span className="avatar">{e.prenom[0]}</span><div><b>{e.prenom} {e.nom}</b><br/>{d===undefined?'…':d>0?<span className="rouge">{tt('⚠️ Reste à payer :')} {tnd(d)}</span>:<span className="vert">{tt('✅ Tout est payé')}</span>}</div></div>
   {d>0&&<div className="rang"><label className="inline"><span>{tt('Montant (TND)')}</span><input type="number" min="1" step="0.001" max={d/1000} value={mt[e.id]!==undefined?mt[e.id]:d/1000} onChange={x=>setMt({...mt,[e.id]:x.target.value})}/></label>
    {actif&&<button className="btn grand" onClick={()=>payer(e)}>{tt('💳 Payer en ligne')}</button>}<button className="btn clair grand" onClick={()=>especes(e)}>{tt('💵 Payer en espèces au secrétariat')}</button></div>}</div>})}
  {Array.isArray(dem)&&dem.length>0&&<><h3>{tt('Mes demandes en espèces')}</h3><div className="tablewrap"><table><thead><tr><th>{tt('Référence')}</th><th>{tt('Élève')}</th><th>{tt('Montant')}</th><th>{tt('Statut')}</th><th></th></tr></thead><tbody>{dem.map(d=><tr key={d.id}><td><code>{d.reference}</code></td><td>{d.prenom} {d.nom}</td><td>{tnd(d.montant_millimes)}</td><td>{tt(({en_attente:'En attente de validation',validee:'Validée',refusee:'Refusée',annulee:'Annulée',expiree:'Expirée'})[d.statut])}{d.motif?' — '+d.motif:''}</td><td>{d.statut==='en_attente'&&<button className="lien danger" onClick={()=>annuler(d)}>{tt('Annuler')}</button>}</td></tr>)}</tbody></table></div></>}</div>}

// Secrétariat (admin / comptable) : demandes d'espèces à valider
export function EspecesSecretariat({onChange}){
 const[l,load]=useLoad('/paiements-especes?statut=en_attente'),[msg,setMsg]=useState(null);
 const valider=async d=>{const v=prompt(tt('Montant réellement reçu en espèces (TND) :'),d.montant_millimes/1000);if(v===null)return;
  try{const r=await api(`/paiements-especes/${d.id}/valider`,{method:'POST',body:{montant_recu_millimes:Math.round(Number(v)*1000)}});setMsg({ok:1,t:tt('Paiement validé et enregistré. Solde restant : {s}.',{s:tnd(r.solde)})});load();onChange&&onChange()}catch(x){setMsg({t:x.message})}};
 const refuser=async d=>{const m=prompt(tt('Motif du refus (facultatif) :'));if(m===null)return;try{await api(`/paiements-especes/${d.id}/refuser`,{method:'POST',body:{motif:m||undefined}});load()}catch(x){setMsg({t:x.message})}};
 if(!Array.isArray(l))return null;
 return<div className="carte"><h2>{tt("💵 Paiements en espèces à valider")}</h2><p className="aide">{tt("Un paiement en espèces n'est enregistré qu'après votre validation, une fois l'argent reçu au guichet.")}</p><Msg m={msg}/>
  {l.length?<div className="tablewrap"><table><thead><tr><th>{tt('Référence')}</th><th>{tt('Parent')}</th><th>{tt('Élève')}</th><th>{tt('Montant annoncé')}</th><th>{tt('Date')}</th><th></th></tr></thead><tbody>{l.map(d=><tr key={d.id}><td><code>{d.reference}</code></td><td>{d.parent}</td><td>{d.prenom} {d.nom}</td><td>{tnd(d.montant_millimes)}</td><td>{fdate(d.created_at)}</td><td className="act"><button className="btn" onClick={()=>valider(d)}>{tt("✅ Valider (argent reçu)")}</button><button className="lien danger" onClick={()=>refuser(d)}>{tt('Refuser')}</button></td></tr>)}</tbody></table></div>:<Vide t={tt("Aucune demande en attente.")}/>}</div>}

// Administrateur : configuration des fournisseurs de paiement de l'école
export function ConfigPaiement(){
 const[c,load]=useLoad('/admin/paiement/config'),[msg,setMsg]=useState(null),[ed,setEd]=useState({});
 if(!c)return<Page titre={tt('Paiements en ligne')}><p>…</p></Page>;
 const noms={public:tt('Clé publique'),private:tt('Clé privée'),apiKey:tt('Clé API'),walletId:tt('Identifiant du portefeuille (wallet)')};
 const sauver=async f=>{const e=ed[f.id]||{};try{await api('/admin/paiement/config/'+f.id,{method:'PUT',body:{actif:e.actif!==undefined?e.actif:f.actif,mode:e.mode||f.mode,secrets:e.secrets||{}}});setMsg({ok:1,t:tt('Configuration enregistrée.')});setEd({...ed,[f.id]:{}});load()}catch(x){setMsg({t:x.message})}};
 const maj=(id,k,v)=>setEd({...ed,[id]:{...(ed[id]||{}),[k]:v}});
 return<Page titre={tt('💳 Paiements en ligne')} sous={tt("Les clés sont fournies par Flouci ou Konnect à l'ouverture de votre compte marchand. Elles sont chiffrées et ne sont jamais réaffichées.")}>
  <Msg m={msg}/>{c.prodReelle&&<p className="note">{tt("Environnement de production : le mode DÉMONSTRATION est désactivé.")}</p>}
  {c.fournisseurs.map(f=>{const e=ed[f.id]||{},demo=f.id==='demo',actif=e.actif!==undefined?e.actif:f.actif;
   return<div key={f.id} className="carte"><h2>{f.label} {f.simule&&<BadgeTest s/>}</h2>
    {demo?<p>{f.actif?tt("Actif : aucun argent réel n'est débité (démonstration)."):tt("Désactivé (production réelle).")}</p>:<>
     <label className="inline"><input type="checkbox" checked={actif} onChange={x=>maj(f.id,'actif',x.target.checked)}/> <span>{tt('Activer ce fournisseur')}</span></label>
     <label className="inline"><span>{tt('Environnement')}</span><select value={e.mode||f.mode} onChange={x=>maj(f.id,'mode',x.target.value)}><option value="sandbox">{tt("Test (sandbox) — aucun argent réel")}</option><option value="live">{tt('Réel (production)')}</option></select></label>
     {Object.entries(f.secretsDefinis).map(([k,def])=><label key={k}><span>{noms[k]||k} {def&&<small>({tt('défini')})</small>}</span><input type="password" autoComplete="off" placeholder={def?'••••••••':''} value={(e.secrets||{})[k]||''} onChange={x=>maj(f.id,'secrets',{...(e.secrets||{}),[k]:x.target.value})}/></label>)}
     {!f.pret&&<p className="aide">{f.raison}</p>}<p className="aide">{tt('Adresse de notification (webhook) :')} <code>{c.webhook[f.id]}</code></p>
     <button className="btn" onClick={()=>sauver(f)}>{tt('Enregistrer')}</button></>}</div>})}</Page>}
