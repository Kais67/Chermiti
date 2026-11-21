import {useEcole} from './Ecole';
import {SelecteurLangue} from './i18n';
import {tt} from './i18n';
import {useEffect,useState} from 'react';import {Routes,Route,NavLink,Navigate,useLocation} from 'react-router-dom';
import {api,download} from './api';import {Ctx,Resource,Page,useApp,tnd,fdate,Photo,Chip} from './ui';
import {ConfigPaiement} from './paiements_ui';
import BI from './BI';
import {Landing,Dashboard,Planning,Bulletins,Notes,Paiements,Impayes,Messages,Annonces,Devoirs,Notifications,Journal,Profil,Etoiles,Aide,PasserelleSimulee,Verifier,VerifierRoute} from './pages';

const R=(...r)=>r;const AD=['admin'],ENS=['admin','enseignant'];
const classeRef={path:'/classes',label:c=>`${tt(c.niveau)} ${c.section}`},matRef={path:'/matieres',label:m=>`${m.nom} (${tt(m.niveau)})`};
const J=[1,2,3,4,5,6].map(v=>({v,t:['','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][v]}));

function Eleves(){const{user,annee}=useApp();const w=['admin','comptable'].includes(user.role);
 return (
  <Resource titre={tt('Élèves')} path="/eleves" canWrite={w} defaults={{annee_scolaire:annee,annee_entree:annee.slice(0,4)}}
   fields={[{k:'nom',label:tt('Nom')},{k:'prenom',label:tt('Prénom')},{k:'date_naissance',label:tt('Naissance'),type:'date'},{k:'classe_id',label:tt('Classe'),ref:classeRef},{k:'annee_entree',label:tt('Année d\'entrée')},{k:'antecedents_medicaux',label:tt('Antécédents médicaux'),type:'textarea',required:false},{k:'annee_scolaire',label:tt('Année scolaire')}]}
   columns={[{label:tt('Photo'),render:r=><Photo id={r.id} nom={r.prenom} v={r.photo}/>,text:()=>''},'nom','prenom','date_naissance','classe_id']}
   actions={(r,load,setMsg)=><>{w&&<EleveActions r={r} load={load} setMsg={setMsg}/>}{user.role==='admin'&&<button className="lien" onClick={async()=>{if(confirm(tt('Anonymiser définitivement ce dossier (droit à l\'effacement) ?'))){await api(`/eleves/${r.id}/anonymiser`,{method:'PUT'});load()}}}>{tt('Anonymiser')}</button>}</>}
   toolbar={w&&((load,setMsg)=><><button className="btn clair" onClick={()=>download('/eleves/export.csv','eleves.csv')}>{tt('Exporter CSV')}</button>{user.role==='admin'&&<label className="btn clair fichier">{tt('Importer CSV')}<input hidden type="file" accept=".csv" onChange={async e=>{const t=await e.target.files[0].text();try{const r=await fetch('/api/eleves/import',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('token')},body:t});const j=await r.json();setMsg(r.ok?{ok:1,t:tt('{0} élève(s) importé(s).', {
    '0': j.importes
   })}:{t:j.erreur});load()}catch(x){setMsg({t:x.message})}e.target.value=''}}/></label>}</>)}/>
 );}

function EleveActions({r,load,setMsg}){return (
 <><button className="lien" onClick={async()=>{try{const x=await api(`/eleves/${r.id}/affecter-auto`,{method:'POST'});setMsg({ok:1,t:tt('Affecté en {0} (âge au 1er septembre : {1} ans).', {
  '0': x.niveau,
  '1': x.age
 })});load()}catch(e){setMsg({t:e.message})}}}>{tt('Affecter auto')}</button>
  <label className="lien" style={{cursor:'pointer',display:'inline',fontSize:'inherit',fontWeight:400}}>{tt('Photo')}<input hidden type="file" accept=".png,.jpg,.jpeg" onChange={async e=>{const fd=new FormData();fd.append('fichier',e.target.files[0]);try{await api(`/eleves/${r.id}/photo`,{method:'POST',form:fd});setMsg({ok:1,t:tt('Photo enregistrée.')});load()}catch(x){setMsg({t:x.message})}e.target.value=''}}/></label></>
);}
const compteMsg=c=>!c?{ok:1,t:tt('Pré-inscription traitée.')}:c.cree?{ok:1,t:tt(
 'Compte parent créé. E-mail : {0} — Mot de passe temporaire : {1} — affiché une seule fois : notez-le et transmettez-le au parent.{2}',
 {
  '0': c.email,
  '1': c.mdp,
  '2': c.email_envoye?tt(
   ' Un e-mail avec ces identifiants lui a aussi été envoyé (statut dans le Journal).'
  ):tt(
   ' Aucun e-mail n\'a été envoyé (envoi non configuré) : transmettez-lui ces identifiants vous-même.'
  )
 }
)}:{ok:1,t:tt('Le parent a déjà un compte ({0}) : l\'élève lui a été rattaché.', {
 '0': c.email
})};
function Preinscriptions(){return (
 <Resource titre={tt('Pré-inscriptions')} path="/preinscriptions" canWrite={false}
  fields={[{k:'prenom',label:tt('Prénom')},{k:'nom',label:tt('Nom')},{k:'date_naissance',label:tt('Naissance')},{k:'parent_nom',label:tt('Parent')},{k:'parent_email',label:tt('E-mail')},{k:'statut',label:tt('Statut')}]}
  actions={(r,load,setMsg)=><>{r.statut==='validee'&&<button className="lien" onClick={async()=>{try{const res=await api(`/preinscriptions/${r.id}/compte`,{method:'POST'});setMsg(compteMsg(res.compte))}catch(x){setMsg({t:x.message})}}}>{tt('Créer le compte parent')}</button>}{r.statut==='en_attente'&&<><button className="lien" onClick={async()=>{try{const res=await api(`/preinscriptions/${r.id}/statut`,{method:'PUT',body:{statut:'validee'}});load();setMsg(compteMsg(res.compte))}catch(x){setMsg({t:x.message})}}}>{tt('Valider')}</button><button className="lien danger" onClick={async()=>{await api(`/preinscriptions/${r.id}/statut`,{method:'PUT',body:{statut:'refusee'}});load()}}>{tt('Refuser')}</button></>}</>}/>
);}

function Absences(){const{user}=useApp();return (
 <Resource titre={tt('Absences')} path="/absences" noEdit canWrite={ENS.includes(user.role)}
  fields={[{k:'eleve_id',label:tt('Élève'),ref:{path:'/eleves',label:e=>`${e.prenom} ${e.nom}`},required:true},{k:'date',label:tt('Date'),type:'date'},{k:'motif',label:tt('Motif'),required:false},{k:'justification',label:tt('Justification parent'),required:false},{k:'justifiee',label:tt('Justifiée'),options:[{v:0,t:tt('Non')},{v:1,t:tt('Oui')}]}]}
  columns={[{label:tt('Élève'),render:r=>`${r.prenom} ${r.nom}`,text:r=>`${r.prenom} ${r.nom}`},'date','motif','justification',{label:tt('Statut'),render:r=>r.justifiee?tt('✅ Justifiée'):r.justification?tt('⏳ À valider'):tt('❌ Non justifiée'),text:r=>String(r.justification)}]}
  actions={(r,load,setMsg)=><>{user.role==='parent'&&!r.justifiee&&<button className="lien" onClick={async()=>{const t=prompt(tt('Motif de justification :'));if(t)try{await api(`/absences/${r.id}/justifier`,{method:'PUT',body:{justification:t}});load()}catch(x){setMsg({t:x.message})}}}>{tt('Justifier')}</button>}
   {user.role==='admin'&&!r.justifiee&&<button className="lien" onClick={async()=>{await api(`/absences/${r.id}/valider`,{method:'PUT'});load()}}>{tt('Valider')}</button>}</>}/>
);}

function Gestion({titre,path,fields,columns,defaults,write=AD}){const{user}=useApp();return<Resource titre={titre} path={path} fields={fields} columns={columns} defaults={defaults} canWrite={write.includes(user.role)}/>}

function PlanningPage(){const{user,annee}=useApp();return (
 <><Planning/>{user.role==='admin'&&<Gestion titre={tt('Gérer les créneaux')} path="/creneaux" defaults={{annee_scolaire:annee}}
  fields={[{k:'classe_id',label:tt('Classe'),ref:classeRef,required:true},{k:'matiere_id',label:tt('Matière'),ref:matRef,required:true},{k:'enseignant_id',label:tt('Enseignant'),ref:{path:'/enseignants',label:e=>e.nom},required:true},{k:'salle_id',label:tt('Salle'),ref:{path:'/salles',label:s=>s.nom},required:true},{k:'jour',label:tt('Jour'),options:J,num:1},{k:'debut',label:tt('Début'),type:'time'},{k:'fin',label:tt('Fin'),type:'time'},{k:'annee_scolaire',label:tt('Année')}]}
  columns={['classe_id','matiere_id','enseignant_id','salle_id','jour','debut','fin']}/>}</>
);}

const NIVEAUX=['1re année','2e année','3e année','4e année','5e année','6e année'].map(v=>({v,t:v}));
const NIVEAUX_M=[{v:'Tous',t:'Tous les niveaux'},...NIVEAUX];
const COULEURS=[['#2f8f77','🟢 Vert'],['#2f6fb5','🔵 Bleu'],['#e8852b','🟠 Orange'],['#7a55b3','🟣 Violet'],['#c99700','🟡 Or'],['#d9482b','🔴 Rouge'],['#d8588c','🌸 Rose'],['#1f9aa8','🩵 Turquoise'],['#6b7280','⚪ Gris']].map(([v,t])=>({v,t}));
const PICTOS=[['livre','📖 Livre'],['crayon','✏️ Crayon'],['calcul','🔢 Calcul'],['science','🔬 Science'],['croissant','🌙 Croissant'],['globe','🌍 Globe'],['sport','⚽ Sport'],['musique','🎵 Musique'],['art','🎨 Art'],['etoile','⭐ Étoile']].map(([v,t])=>({v,t}));
// Menu regroupé par thème. Pour la Direction, « Utilisateurs » est le premier bouton.
const NAV={
 admin:[{g:'👥 Personnes',items:[['/utilisateurs','👥','Utilisateurs'],['/eleves','🧒','Élèves'],['/preinscriptions','📝','Pré-inscriptions']]},
  {g:'🏫 École',items:[['/annees','📅','Années scolaires'],['/classes','🏫','Classes'],['/matieres','📚','Matières'],['/salles','🚪','Salles'],['/affectations','🔗','Affectations'],['/planning','🗓️','Emploi du temps']]},
  {g:'📊 Pédagogie',items:[['/evaluations','✍️','Évaluations'],['/notes','🔢','Saisie des notes'],['/bulletins','📄','Bulletins'],['/absences','🕒','Absences'],['/devoirs','📝','Devoirs'],['/etoiles','⭐','Étoiles']]},
  {g:'💰 Finances',items:[['/tarifs','🏷️','Grille tarifaire'],['/frais','🧾','Frais scolaires'],['/paiements','💳','Paiements'],['/impayes','⚠️','Impayés'],['/config-paiement','⚙️','Paiements en ligne']]},
  {g:'✉️ Communication',items:[['/messages','✉️','Messagerie'],['/annonces','📢','Annonces']]},
  {g:'🛡️ Contrôle',items:[['/journal','🛡️','Journal'],['/aide','❓','Aide et légende']]}],
 enseignant:[{g:'🏠 Mon espace',items:[['/','🏠','Accueil'],['/planning','🗓️','Emploi du temps'],['/eleves','🧒','Mes élèves']]},
  {g:'📊 Pédagogie',items:[['/evaluations','✍️','Évaluations'],['/notes','🔢','Saisie des notes'],['/bulletins','📄','Bulletins'],['/absences','🕒','Absences'],['/devoirs','📝','Devoirs'],['/etoiles','⭐','Étoiles']]},
  {g:'✉️ Communication',items:[['/messages','✉️','Messagerie'],['/annonces','📢','Annonces'],['/aide','❓','Aide']]}],
 parent:[{g:'🏠 Mon espace',items:[['/','🏠','Accueil'],['/eleves','🧒','Mes enfants']]},
  {g:'📊 Suivi de mes enfants',items:[['/bulletins','📄','Notes et bulletins'],['/absences','🕒','Absences'],['/devoirs','📝','Devoirs'],['/planning','🗓️','Emploi du temps'],['/etoiles','⭐','Étoiles']]},
  {g:'💰 Paiements',items:[['/paiements','💳','Payer et reçus']]},
  {g:'✉️ Communication',items:[['/messages','✉️','Messagerie'],['/annonces','📢','Annonces'],['/aide','❓','Aide']]}],
 eleve:[{g:'🏠 Mon espace',items:[['/','🏠','Accueil'],['/planning','🗓️','Emploi du temps'],['/devoirs','📝','Mes devoirs']]},
  {g:'⭐ Mes résultats',items:[['/bulletins','📄','Mes notes'],['/etoiles','⭐','Mes étoiles']]},
  {g:'✉️ Communication',items:[['/messages','✉️','Messagerie'],['/annonces','📢','Annonces'],['/aide','❓','Aide']]}],
 comptable:[{g:'📈 Pilotage',items:[['/bi','📈','Tableaux de bord']]},{g:'👥 Personnes',items:[['/','🏠','Accueil'],['/eleves','🧒','Élèves'],['/preinscriptions','📝','Pré-inscriptions']]},
  {g:'💰 Finances',items:[['/tarifs','🏷️','Grille tarifaire'],['/frais','🧾','Frais scolaires'],['/paiements','💳','Paiements'],['/impayes','⚠️','Impayés']]},
  {g:'✉️ Communication',items:[['/messages','✉️','Messagerie'],['/annonces','📢','Annonces'],['/aide','❓','Aide']]}]};

export default function App(){
 const ecole=useEcole();
 const[user,setUser]=useState(null),[annee,setAnnee]=useState('2026-2027'),[ready,setReady]=useState(false),[nb,setNb]=useState(0),[open,setOpen]=useState(false);const loc=useLocation();
 useEffect(()=>{if(!localStorage.getItem('token'))return setReady(true);api('/auth/moi').then(setUser).catch(()=>{}).finally(()=>setReady(true))},[]);
 useEffect(()=>{if(!user)return;api('/annees').then(a=>{const x=a.find(y=>y.active);if(x)setAnnee(x.libelle)}).catch(()=>{});const f=()=>api('/notifications').then(n=>setNb(n.filter(x=>!x.lue).length)).catch(()=>{});f();const t=setInterval(f,30000);const g=()=>setUser(u=>u&&{...u,mdp_temporaire:false});window.addEventListener('notifs',f);window.addEventListener('mdp-ok',g);return()=>{clearInterval(t);window.removeEventListener('notifs',f);window.removeEventListener('mdp-ok',g)}},[user,loc.pathname]);
 useEffect(()=>setOpen(false),[loc.pathname]);
 if(!ready)return <p className="chargement">{tt('Chargement…')}</p>;
 if(!user){const pt=loc.pathname.split('/');return pt[1]==='verifier'?<Verifier id={pt[2]} code={pt[3]}/>:<Landing onLogin={setUser}/>}
 const nav=NAV[user.role];
 return (
  <Ctx.Provider value={{user,annee}}><a className="skip" href="#contenu">{tt('Aller au contenu')}</a>
   <div className={'app'+(['parent','eleve'].includes(user.role)?' simple':'')}><aside className={'menu '+(open?'ouvert':'')}><NavLink to="/" className="marque" aria-label={tt('Accueil')}><img src="/logo.svg" alt="" width="36" height="36"/><span>{ecole.nom}</span></NavLink><nav aria-label={tt('Navigation principale')}>{nav.map(g=><div key={g.g} className="groupe"><p className="gtitre">{tt(g.g)}</p>{g.items.map(([to,ic,t])=><NavLink key={to} to={to} end={to==='/'} title={tt(t)}><span className="ic" aria-hidden="true">{ic}</span>{tt(t)}</NavLink>)}</div>)}</nav><SelecteurLangue className="menu-langues"/></aside>
   <div className="cote"><header className="haut"><button className="burger" aria-label={tt('Menu')} onClick={()=>setOpen(!open)}>☰</button><NavLink to="/" end className="lien" style={{textDecoration:'none'}}>{tt('🏠 Accueil')}</NavLink><span className="role">{user.nom}</span>
    <NavLink to="/profil" className="lien" style={{textDecoration:'none'}}>{tt('Mon profil')}</NavLink><NavLink to="/notifications" className="cloche" aria-label={tt('Notifications ({0} non lues)', {
    '0': nb
   })}>🔔{nb>0&&<b>{nb}</b>}</NavLink><button className="btn clair" onClick={()=>{localStorage.clear();location.href='/'}}>{tt('Déconnexion')}</button></header>
   {user.mdp_temporaire&&<div role="alert" className="note err" style={{margin:0,borderRadius:0,textAlign:'center'}}>{tt('Votre mot de passe est temporaire.')} <NavLink to="/profil">{tt('Changez-le maintenant')}</NavLink>.</div>}<main id="contenu"><Routes>
    <Route path="/" element={<Dashboard/>}/><Route path="/eleves" element={<Eleves/>}/><Route path="/preinscriptions" element={<Preinscriptions/>}/>
    <Route path="/classes" element={<Gestion titre={tt('Classes')} path="/classes" defaults={{annee_scolaire:annee,section:'A'}} fields={[{k:'niveau',label:tt('Niveau'),options:NIVEAUX},{k:'section',label:tt('Section')},{k:'capacite',label:tt('Capacité'),type:'number',required:true},{k:'titulaire_id',label:tt('Titulaire'),ref:{path:'/enseignants',label:e=>e.nom}},{k:'annee_scolaire',label:tt('Année scolaire')}]} columns={['niveau','section','capacite','titulaire_id','annee_scolaire']}/>}/>
     <Route path="/matieres" element={<Gestion titre={tt('Matières')} path="/matieres" fields={[{k:'nom',label:tt('Nom')},{k:'coefficient',label:tt('Coefficient'),type:'number',step:'0.5',required:true},{k:'niveau',label:tt('Niveau'),options:NIVEAUX_M},{k:'couleur',label:tt('Couleur du thème'),required:false,options:COULEURS},{k:'icone',label:tt('Pictogramme'),required:false,options:PICTOS}]} columns={[{label:tt('Matière'),render:r=><Chip nom={r.nom} couleur={r.couleur} icone={r.icone}/>,text:r=>r.nom},'coefficient','niveau']}/>}/>
    <Route path="/salles" element={<Gestion titre={tt('Salles')} path="/salles" defaults={{disponible:1}} fields={[{k:'nom',label:tt('Nom')},{k:'capacite',label:tt('Capacité'),type:'number',required:true},{k:'disponible',label:tt('Disponible'),options:[{v:1,t:tt('Oui')},{v:0,t:tt('Non')}],num:1}]}/>}/>
    <Route path="/utilisateurs" element={<Resource titre={tt('Utilisateurs')} path="/utilisateurs" canWrite fields={[{k:'nom',label:tt('Nom')},{k:'email',label:tt('E-mail'),type:'email'},{k:'password',label:tt('Mot de passe (8 car. min. ; vide = inchangé)'),type:'password',required:false},{k:'telephone',label:tt('Téléphone'),required:false},{k:'adresse',label:tt('Adresse'),required:false},{k:'role',label:tt('Rôle'),options:['admin','enseignant','parent','eleve','comptable'].map(v=>({v,t:v}))}]} columns={['nom','email','role']}
      actions={(r,load,setMsg)=><><button className="lien" onClick={async()=>{if(!confirm("Générer un nouveau mot de passe temporaire pour "+r.email+" ? L'ancien ne fonctionnera plus."))return;try{const x=await api(`/utilisateurs/${r.id}/reinitialiser`,{method:'POST'});setMsg({ok:1,t:tt(
       'Nouveau mot de passe temporaire pour {0} : {1} — affiché une seule fois : notez-le et transmettez-le à l\'utilisateur.{2}',
       {
        '0': x.email,
        '1': x.mdp,
        '2': x.email_envoye?tt(' Un e-mail lui a aussi été envoyé.'):''
       }
      )})}catch(e){setMsg({t:e.message})}}}>{tt('Nouveau mot de passe')}</button>{r.role==='parent'&&<button className="lien" onClick={async()=>{const e=prompt(tt('Numéro (id) de l\'élève à rattacher à ce parent :'));if(e)try{await api('/parent-eleve',{method:'POST',body:{parent_id:r.id,eleve_id:Number(e)}});alert(tt('Rattaché.'))}catch(x){alert(x.message)}}}>{tt('Rattacher un élève')}</button>}</>}/>}/>
    <Route path="/planning" element={<PlanningPage/>}/>
    <Route path="/affectations" element={<Resource titre={tt('Affectations enseignants')} path="/affectations" canWrite defaults={{annee_scolaire:annee}} fields={[{k:'enseignant_id',label:tt('Enseignant'),ref:{path:'/enseignants',label:e=>e.nom},required:true},{k:'matiere_id',label:tt('Matière'),ref:matRef,required:true},{k:'classe_id',label:tt('Classe'),ref:classeRef,required:true},{k:'annee_scolaire',label:tt('Année')}]}/>}/>
    <Route path="/tarifs" element={<Resource titre={tt('Grille tarifaire')} path="/tarifs" canWrite defaults={{annee_scolaire:annee}} fields={[{k:'niveau',label:tt('Niveau'),options:NIVEAUX},{k:'libelle',label:tt('Libellé')},{k:'montant_millimes',label:tt('Montant (millimes)'),type:'number',required:true},{k:'annee_scolaire',label:tt('Année')}]} columns={['niveau','libelle',{label:tt('Montant'),render:r=>tnd(r.montant_millimes),text:r=>tnd(r.montant_millimes)},'annee_scolaire']}
      toolbar={(load,setMsg)=><button className="btn clair" onClick={async()=>{try{const x=await api('/tarifs/appliquer',{method:'POST'});setMsg({ok:1,t:tt('{0} frais créé(s) pour les élèves concernés.', {
       '0': x.frais_crees
      })})}catch(e){setMsg({t:e.message})}}}>{tt('Appliquer aux élèves')}</button>}/>}/>
    <Route path="/evaluations" element={<Gestion titre={tt('Évaluations')} path="/evaluations" write={ENS} defaults={{annee_scolaire:annee,bareme:20,type:'controle_continu'}} fields={[{k:'titre',label:tt('Titre')},{k:'classe_id',label:tt('Classe'),ref:classeRef,required:true},{k:'matiere_id',label:tt('Matière'),ref:matRef,required:true},{k:'trimestre',label:tt('Trimestre'),options:[1,2,3].map(v=>({v,t:'T'+v})),num:1},{k:'type',label:tt('Type'),options:[{v:'controle_continu',t:tt('Contrôle continu')},{v:'examen',t:tt('Examen trimestriel')}]},{k:'bareme',label:tt('Barème'),type:'number',required:true},{k:'annee_scolaire',label:tt('Année')}]} columns={['titre','classe_id','matiere_id','trimestre','type','bareme']}/>}/>
    <Route path="/notes" element={<Notes/>}/><Route path="/bulletins" element={<Bulletins/>}/><Route path="/absences" element={<Absences/>}/>
    <Route path="/frais" element={<Gestion titre={tt('Frais scolaires')} path="/frais" write={['admin','comptable']} defaults={{annee_scolaire:annee}} fields={[{k:'eleve_id',label:tt('Élève'),ref:{path:'/eleves',label:e=>`${e.prenom} ${e.nom}`},required:true},{k:'libelle',label:tt('Libellé')},{k:'montant_millimes',label:tt('Montant (millimes)'),type:'number',required:true},{k:'annee_scolaire',label:tt('Année')}]} columns={['eleve_id','libelle',{label:tt('Montant'),render:r=>tnd(r.montant_millimes),text:r=>tnd(r.montant_millimes)}]}/>}/>
    <Route path="/paiements" element={<Paiements/>}/><Route path="/impayes" element={<Impayes/>}/><Route path="/config-paiement" element={<ConfigPaiement/>}/><Route path="/bi" element={<BI user={user}/>}/><Route path="/devoirs" element={<Devoirs/>}/><Route path="/messages" element={<Messages/>}/>
    <Route path="/annonces" element={<Annonces/>}/><Route path="/notifications" element={<Notifications/>}/><Route path="/journal" element={<Journal/>}/>
    <Route path="/annees" element={<Resource titre={tt('Années scolaires')} path="/annees" canWrite noEdit noDelete fields={[{k:'libelle',label:tt('Année (AAAA-AAAA, ex. 2027-2028)')}]} columns={['libelle',{label:tt('Statut'),render:r=>r.active?tt('✓ Année active'):'—',text:r=>r.active?'active':''}]}
      actions={(r,load,setMsg)=>!r.active&&<button className="lien" onClick={async()=>{if(!confirm(tt(
       'Activer cette année ? Les nouveaux paiements, classes et évaluations y seront rattachés. Créez d\'abord les classes de la nouvelle année.'
      )))return;try{await api(`/annees/${r.id}/activer`,{method:'PUT'});location.reload()}catch(x){setMsg({t:x.message})}}}>{tt('Activer')}</button>}/>}/>
    <Route path="/paiement/:token" element={<PasserelleSimulee/>}/><Route path="/etoiles" element={<Etoiles/>}/><Route path="/aide" element={<Aide/>}/><Route path="/verifier/:id/:code" element={<VerifierRoute/>}/>
     <Route path="/profil" element={<Profil/>}/><Route path="*" element={<Navigate to="/"/>}/>
   </Routes></main></div></div></Ctx.Provider>
 );}
