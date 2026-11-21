// Système de traduction centralisé. Le FRANÇAIS est la langue source et par défaut : la clé d'une traduction est le texte français.
// Catalogues : ./ar.json et ./en.json (clé française → traduction). Texte absent d'un catalogue → affiché en français.
// Variables : tt('Bonjour {nom}',{nom:'Sami'}). Messages du serveur : tr_serveur() (motifs avec {…} acceptés).
import{createContext,useContext,useState,useEffect,useMemo}from'react';
import ar from'./ar.json';import en from'./en.json';
export const LANGS={fr:{nom:'Français',court:'FR',dir:'ltr',locale:'fr-TN'},ar:{nom:'العربية',court:'ع',dir:'rtl',locale:'ar-TN-u-nu-latn'},en:{nom:'English',court:'EN',dir:'ltr',locale:'en-GB'}};
const CAT={ar,en};
let cur=(()=>{try{const l=localStorage.getItem('lang');return LANGS[l]?l:'fr'}catch{return'fr'}})();
const interp=(s,v)=>v?s.replace(/\{(\w+)\}/g,(m,k)=>v[k]!==undefined?v[k]:m):s;
export const langue=()=>cur;
export function tt(k,v){if(typeof k!=='string')return k;const c=CAT[cur];return interp((c&&c[k])||k,v)}
// Messages d'erreur du serveur (français) : correspondance exacte, sinon par motif (« …({n} TND) »)
const motifs={};
function motifsDe(l){if(!motifs[l]){motifs[l]=Object.keys(CAT[l]||{}).filter(k=>k.includes('{')).map(k=>{const noms=[...k.matchAll(/\{(\w+)\}/g)].map(m=>m[1]);
  return{k,noms,re:new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{\w+\}/g,'(.+?)')+'$')}})}return motifs[l]}
export function tr_serveur(m){if(typeof m!=='string'||cur==='fr')return m;const c=CAT[cur]||{};if(c[m])return c[m];
 for(const{k,noms,re}of motifsDe(cur)){const x=re.exec(m);if(x)return interp(c[k],Object.fromEntries(noms.map((n,i)=>[n,x[i+1]])))}return m}
export const fmtDate=(d,opt)=>{try{return new Intl.DateTimeFormat(LANGS[cur].locale,opt||{dateStyle:'medium'}).format(new Date(d))}catch{return d}};
export const fmtNum=(n,opt)=>new Intl.NumberFormat(LANGS[cur].locale,opt).format(n);
export function appliquer(l){const d=document.documentElement;d.lang=l;d.dir=LANGS[l].dir;document.title=document.title}
const Ctx=createContext({lang:cur,setLang(){}});
export const useLang=()=>useContext(Ctx);
export function I18nProvider({children,defaut='fr'}){
 const[lang,setL]=useState(()=>{try{return localStorage.getItem('lang')?cur:(LANGS[defaut]?defaut:'fr')}catch{return'fr'}});
 cur=lang;
 useEffect(()=>{appliquer(lang)},[lang]);
 const setLang=(l,persist=true)=>{if(!LANGS[l])return;if(persist)try{localStorage.setItem('lang',l)}catch{}cur=l;setL(l)};
 const v=useMemo(()=>({lang,setLang}),[lang]);
 // key={lang} : tout l'arbre est recalculé au changement de langue
 return<Ctx.Provider value={v}><div key={lang} style={{display:'contents'}}>{children}</div></Ctx.Provider>}
export function SelecteurLangue({className=''}){const{lang,setLang}=useLang();
 return<div className={'langues '+className} role="group" aria-label="Langue / اللغة / Language">{Object.entries(LANGS).map(([k,v])=><button key={k} type="button" className={k===lang?'on':''} lang={k} aria-pressed={k===lang} onClick={()=>setLang(k)}>{v.nom}</button>)}</div>}
