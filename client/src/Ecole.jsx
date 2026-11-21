// Sélection de l'école (multi-écoles) : charge l'école courante ; si elle n'est pas déterminée (application mobile, site commun),
// demande le code de l'école. Fournit le nom de l'école au reste de l'application.
import{createContext,useContext,useEffect,useState}from'react';
import{api}from'./api';import{tt,useLang,SelecteurLangue}from'./i18n';
const EC=createContext({nom:'',slug:''});export const useEcole=()=>useContext(EC);
export function EcoleGate({children}){
 const[info,setInfo]=useState(null),[liste,setListe]=useState([]),[need,setNeed]=useState(false),[code,setCode]=useState(localStorage.getItem('ecole')||''),[m,setM]=useState(null),{setLang}=useLang();
 const charger=()=>api('/public/ecole').then(i=>{setInfo(i);setNeed(false);if(i.nom)document.title=i.nom;if(!localStorage.getItem('lang'))setLang(i.langue_defaut,false)}).catch(e=>{if(['ECOLE_REQUISE','ECOLE_INCONNUE','ECOLE_SUSPENDUE'].includes(e.code)){setNeed(true);if(e.code!=='ECOLE_REQUISE')setM(e.message)}else{setInfo({nom:'',slug:''})}});
 useEffect(()=>{charger();api('/public/ecoles').then(l=>Array.isArray(l)&&setListe(l)).catch(()=>{})},[]);
 const choisir=slug=>{localStorage.setItem('ecole',slug);setM(null);charger()};
 const valider=e=>{e.preventDefault();const c=code.trim().toLowerCase();if(!c)return;localStorage.setItem('ecole',c);setM(null);charger()};
 if(need)return<main className="landing"><div className="carte" style={{maxWidth:420,margin:'10vh auto'}}><SelecteurLangue/><h1 style={{fontSize:'1.4rem'}}>{tt("Code de l'école")}</h1><p className="aide">{tt("Saisissez le code communiqué par votre école (exemple : mon-ecole).")}</p>
  {liste.length>0&&<div className="choix-ecoles" role="group" aria-label={tt('Écoles de démonstration')}>{liste.map(e=><button key={e.slug} type="button" className="btn clair grand" onClick={()=>choisir(e.slug)}>🏫 {e.nom}</button>)}</div>}<form onSubmit={valider}><label><span>{tt("Code de l'école")}</span><input value={code} onChange={e=>setCode(e.target.value)} autoCapitalize="none" autoCorrect="off" required/></label>{m&&<p className="msg err" role="alert">{m}</p>}<button className="btn">{tt('Continuer')}</button></form></div></main>;
 if(!info)return<p className="chargement">{tt('Chargement…')}</p>;
 return<EC.Provider value={info}>{children}</EC.Provider>}
export const changerEcole=()=>{localStorage.removeItem('ecole');localStorage.removeItem('token');location.href='/'};
