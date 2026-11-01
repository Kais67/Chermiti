// Documents PDF : bulletin illustré et reçu de paiement (pictogrammes et QR dessinés en vectoriel)
const PDFDocument=require('pdfkit'),QRCode=require('qrcode');
const{codeRecu}=require('./lib/recu'),{montantEnLettres}=require('./lib/lettres'),{theme,appreciation}=require('./lib/theme'),{moyennes}=require('./services/grades');
const C={navy:'#1b2b5a',navy2:'#2c3f7c',cream:'#fbf5e6',coral:'#f26a4b',sun:'#f7c548',gray:'#6b7280',line:'#e3dcc4',white:'#ffffff',green:'#1f7a5c',greenBg:'#e4f5ee',orange:'#e8852b',track:'#ece6d2'};
const fmt=m=>(m/1000).toFixed(3).replace('.',',');
const fdate=d=>{try{return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}catch{return String(d)}};
const MODES={especes:'Espèces',virement:'Virement bancaire',mobile_money:'Mobile money',carte_en_ligne:'Paiement en ligne'};
function T(doc,s,x,y,o={}){doc.font(o.font||'Helvetica').fontSize(o.size||10).fillColor(o.color||C.navy).text(String(s),x,y,{width:o.width,align:o.align,lineBreak:!!o.wrap,characterSpacing:o.spacing})}
const B='Helvetica-Bold',I='Helvetica-Oblique';
function star(doc,cx,cy,R,color){const p=[];for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?R*0.42:R;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)])}doc.polygon(...p).fill(color)}
function logo(doc,x,y,s){doc.roundedRect(x,y,s,s,s*0.22).fill(C.navy2);doc.save();doc.translate(x,y).scale(s/64);
 doc.polygon([12,22],[31,26],[31,52],[12,48]).fill(C.cream);doc.polygon([52,22],[33,26],[33,52],[52,48]).fill(C.cream);
 for(const yy of[31,37])for(const xx of[16,38])doc.rect(xx,yy,10,2).fill(C.coral);star(doc,47,15,9,C.sun);doc.restore()}
function bar(doc,x,y,w,h,pct,color,mark){doc.roundedRect(x,y,w,h,h/2).fill(C.track);const fw=Math.max(h,w*Math.min(100,Math.max(0,pct))/100);doc.roundedRect(x,y,fw,h,h/2).fill(color);
 if(mark!==null&&mark!==undefined){const mx=x+w*Math.min(100,Math.max(0,mark))/100;doc.rect(mx-1,y-3,2,h+6).fill(C.navy)}}
// Pictogrammes blancs dessinés dans un disque de couleur
function picto(doc,k,cx,cy,s,col){const w='#ffffff';
 if(k==='livre'){doc.polygon([cx-s,cy-s*0.6],[cx-s*0.08,cy-s*0.4],[cx-s*0.08,cy+s*0.6],[cx-s,cy+s*0.4]).fill(w);doc.polygon([cx+s,cy-s*0.6],[cx+s*0.08,cy-s*0.4],[cx+s*0.08,cy+s*0.6],[cx+s,cy+s*0.4]).fill(w)}
 else if(k==='crayon'){doc.save();doc.rotate(45,{origin:[cx,cy]});doc.rect(cx-s*0.2,cy-s,s*0.4,s*1.35).fill(w);doc.polygon([cx-s*0.2,cy+s*0.35],[cx+s*0.2,cy+s*0.35],[cx,cy+s]).fill(w);doc.restore()}
 else if(k==='calcul'){doc.rect(cx-s*0.95,cy-s*0.62,s*0.9,s*0.2).fill(w);doc.rect(cx-s*0.6,cy-s*0.97,s*0.2,s*0.9).fill(w);doc.rect(cx+s*0.1,cy+s*0.45,s*0.85,s*0.2).fill(w);doc.rect(cx+s*0.1,cy-s*0.1,s*0.85,s*0.2).fill(w);doc.rect(cx-s*0.95,cy+s*0.45,s*0.85,s*0.2).fill(w)}
 else if(k==='science'){doc.polygon([cx-s*0.25,cy-s],[cx+s*0.25,cy-s],[cx+s*0.25,cy-s*0.2],[cx+s*0.9,cy+s*0.85],[cx-s*0.9,cy+s*0.85],[cx-s*0.25,cy-s*0.2]).fill(w);doc.polygon([cx-s*0.6,cy+s*0.3],[cx+s*0.6,cy+s*0.3],[cx+s*0.9,cy+s*0.85],[cx-s*0.9,cy+s*0.85]).fill(col)}
 else if(k==='croissant'){doc.circle(cx,cy,s*0.92).fill(w);doc.circle(cx+s*0.42,cy-s*0.12,s*0.78).fill(col)}
 else if(k==='globe'){doc.lineWidth(1.3).strokeColor(w);doc.circle(cx,cy,s*0.92).stroke();doc.ellipse(cx,cy,s*0.42,s*0.92).stroke();doc.moveTo(cx-s*0.92,cy).lineTo(cx+s*0.92,cy).stroke()}
 else if(k==='sport'){doc.lineWidth(1.3).strokeColor(w);doc.circle(cx,cy,s*0.92).stroke();doc.moveTo(cx,cy-s*0.92).lineTo(cx,cy+s*0.92).stroke();doc.moveTo(cx-s*0.92,cy).lineTo(cx+s*0.92,cy).stroke();doc.circle(cx,cy,s*0.38).stroke()}
 else if(k==='musique'){doc.ellipse(cx-s*0.3,cy+s*0.55,s*0.4,s*0.28).fill(w);doc.rect(cx+s*0.03,cy-s*0.85,s*0.17,s*1.4).fill(w);doc.polygon([cx+s*0.2,cy-s*0.85],[cx+s*0.8,cy-s*0.4],[cx+s*0.2,cy-s*0.25]).fill(w)}
 else if(k==='art'){doc.circle(cx,cy,s*0.92).fill(w);doc.circle(cx-s*0.3,cy-s*0.2,s*0.18).fill(col);doc.circle(cx+s*0.25,cy-s*0.35,s*0.18).fill('#f7c548');doc.circle(cx+s*0.4,cy+s*0.2,s*0.18).fill('#2f6fb5')}
 else star(doc,cx,cy+s*0.05,s,w)}
function pictoMode(doc,k,cx,cy,s){const w='#ffffff';
 if(k==='especes'){doc.circle(cx-s*0.3,cy+s*0.2,s*0.55).fill(w);doc.circle(cx+s*0.3,cy-s*0.2,s*0.55).fill(w);doc.circle(cx+s*0.3,cy-s*0.2,s*0.3).fill(C.green)}
 else if(k==='virement'){doc.polygon([cx-s,cy-s*0.2],[cx,cy-s],[cx+s,cy-s*0.2]).fill(w);for(const dx of[-0.65,-0.1,0.45])doc.rect(cx+s*dx,cy-s*0.1,s*0.28,s*0.7).fill(w);doc.rect(cx-s,cy+s*0.7,s*2,s*0.25).fill(w)}
 else if(k==='mobile_money'){doc.roundedRect(cx-s*0.5,cy-s,s,s*2,s*0.2).fill(w);doc.rect(cx-s*0.36,cy-s*0.75,s*0.72,s*1.2).fill(C.green);doc.circle(cx,cy+s*0.7,s*0.12).fill(C.green)}
 else{doc.roundedRect(cx-s,cy-s*0.62,s*2,s*1.24,s*0.18).fill(w);doc.rect(cx-s,cy-s*0.28,s*2,s*0.3).fill(C.green);doc.rect(cx-s*0.8,cy+s*0.25,s*0.7,s*0.18).fill(C.green)}}
function base(res,name){const doc=new PDFDocument({size:'A4',margin:0,info:{Title:name,Author:'École Abou El Kacem Chebbi'}});
 if(res.setHeader){res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${name}"`)}doc.pipe(res);return doc}
function entete(doc,titre,sous,deco=true){doc.rect(0,0,595,104).fill(C.navy);doc.rect(0,104,595,4).fill(C.sun);logo(doc,36,22,60);
 T(doc,'École Abou El Kacem Chebbi',112,28,{size:21,font:B,color:C.white});T(doc,titre,112,58,{size:12,font:B,color:C.sun,spacing:1.5});T(doc,sous,112,77,{size:10,color:'#d7dcf0'});
 if(deco){star(doc,548,30,11,C.sun);star(doc,522,60,6,'#8f9cd1');star(doc,560,72,5,'#8f9cd1')}}
function pied(doc,txt){doc.rect(0,812,595,1).fill(C.line);T(doc,txt,36,822,{size:7.5,color:C.gray,width:523,align:'center'})}

function bulletin(res,data){const{eleve:e,trimestre:t,annee,m,absences:ab,etoiles}=data;const doc=base(res,`bulletin-${e.id}-T${t}.pdf`);
 entete(doc,'BULLETIN SCOLAIRE',`Trimestre ${t}   •   Année scolaire ${annee}`);
 doc.roundedRect(36,124,523,76,12).fillAndStroke(C.cream,C.line);doc.circle(76,162,25).fill(C.coral);
 T(doc,((e.prenom||'?')[0]+(e.nom||'?')[0]).toUpperCase(),51,150,{size:20,font:B,color:C.white,width:50,align:'center'});
 T(doc,`${e.prenom} ${e.nom}`,114,137,{size:17,font:B});T(doc,`Classe : ${e.niveau?e.niveau+' '+(e.section||''):'—'}`,114,162,{size:10,color:C.gray});
 T(doc,`Enseignant(e) : ${e.titulaire||'—'}`,114,176,{size:10,color:C.gray});T(doc,`Édité le ${fdate(new Date())}`,380,176,{size:9,color:C.gray,width:170,align:'right'});
 T(doc,'Résultats par matière',36,214,{size:12,font:B});T(doc,'Barre = moyenne sur 20   |   trait foncé = moyenne de la classe',250,217,{size:8,color:C.gray,width:309,align:'right'});
 let y=236;
 if(!m.matieres.length){T(doc,'Aucune note enregistrée pour ce trimestre.',36,y+10,{size:11,font:I,color:C.gray});y+=40}
 for(const x of m.matieres){if(y+44>770){doc.addPage();y=50}
  doc.roundedRect(36,y,523,42,8).fillAndStroke(C.white,C.line);doc.roundedRect(36,y,8,42,4).fill(x.couleur);
  doc.circle(68,y+21,15).fill(x.couleur);picto(doc,x.icone,68,y+21,8.5,x.couleur);
  T(doc,x.nom,90,y+8,{size:12.5,font:B,width:150});T(doc,`Coefficient ${x.coefficient}`,90,y+25,{size:8.5,color:C.gray});
  T(doc,x.moy.toFixed(2),232,y+7,{size:20,font:B,color:x.appreciation.couleur,width:62,align:'right'});T(doc,'/20',298,y+17,{size:9,color:C.gray});
  bar(doc,340,y+16,112,9,x.moy/20*100,x.appreciation.couleur,x.moy_classe===null?null:x.moy_classe/20*100);
  T(doc,x.moy_classe===null?'':`Classe : ${x.moy_classe.toFixed(1)}`,340,y+29,{size:7.5,color:C.gray});
  for(let i=0;i<3;i++)star(doc,470+i*15,y+13,6,i<x.appreciation.etoiles?C.sun:'#e3dcc4');
  T(doc,x.appreciation.label,462,y+25,{size:8.5,font:B,color:x.appreciation.couleur,width:94});y+=46}
 if(y>640){doc.addPage();y=50}
 const g=m.appreciation_generale;y+=4;doc.roundedRect(36,y,523,84,12).fillAndStroke(C.cream,C.line);
 const gc=g?g.couleur:C.gray;doc.circle(88,y+42,34).fill(gc);
 T(doc,m.generale===null?'—':m.generale.toFixed(2),54,y+30,{size:21,font:B,color:C.white,width:68,align:'center'});T(doc,'/20',54,y+54,{size:9,color:C.white,width:68,align:'center'});
 T(doc,'Moyenne générale',140,y+12,{size:14,font:B});if(g){T(doc,g.label,140,y+32,{size:12,font:B,color:g.couleur});for(let i=0;i<3;i++)star(doc,260+i*18,y+39,7.5,i<g.etoiles?C.sun:'#e3dcc4')}
 T(doc,`Absences : ${ab.total}  (dont ${ab.justifiees} justifiée${ab.justifiees>1?'s':''})`,140,y+54,{size:10,color:C.gray});
 star(doc,401,y+60,6,C.sun);T(doc,`Étoiles de félicitations : ${etoiles}`,412,y+54,{size:10,color:C.gray});
 y+=98;T(doc,"Appréciation de l'enseignant(e)",36,y,{size:10,font:B});
 for(const dy of[24,42]){doc.dash(2,{space:3}).moveTo(36,y+dy).lineTo(559,y+dy).lineWidth(0.8).strokeColor(C.line).stroke().undash()}
 y+=54;for(const[i,l]of[[0,'Signature de la Direction'],[1,'Signature du parent']]){doc.roundedRect(36+i*270,y,253,46,8).lineWidth(0.8).stroke(C.line);T(doc,l,46+i*270,y+6,{size:8,color:C.gray})}
 pied(doc,"Bulletin généré par l'application de gestion de l'École Abou El Kacem Chebbi");doc.end()}

function recu(res,data){const{p,classe,total,reste,paye,code,eleve}=data;const doc=base(res,`recu-${p.id}.pdf`);
 entete(doc,'REÇU DE PAIEMENT',`Année scolaire ${p.annee_scolaire}`,false);
 doc.roundedRect(432,24,126,56,10).fill(C.navy2);T(doc,'N°',444,30,{size:9,font:B,color:C.sun});T(doc,String(p.id).padStart(6,'0'),440,44,{size:21,font:B,color:C.white,width:110,align:'center'});
 doc.roundedRect(36,128,523,108,14).fillAndStroke(C.greenBg,'#bfe3d3');
 T(doc,'MONTANT REÇU',54,144,{size:9,font:B,color:C.green,spacing:1.5});T(doc,`${fmt(p.montant_millimes)} TND`,54,158,{size:36,font:B,color:C.green});
 T(doc,montantEnLettres(p.montant_millimes),54,206,{size:10,font:I,width:370,wrap:true});
 doc.circle(498,172,34).fill(C.green);pictoMode(doc,p.mode,498,172,16);T(doc,MODES[p.mode]||p.mode,440,212,{size:9,font:B,color:C.green,width:116,align:'center'});
 const cell=(x,yy,l,v)=>{T(doc,l.toUpperCase(),x,yy,{size:8,font:B,color:C.gray,spacing:0.8});T(doc,v,x,yy+12,{size:12,font:B,width:240})};
 const R=[['Élève',`${eleve.prenom} ${eleve.nom}`,'Classe',classe],['Date du paiement',fdate(p.date),'Canal',p.canal==='en_ligne'?'En ligne':'Guichet de l\'école'],['Référence',p.reference||'—','Mode de paiement',MODES[p.mode]||p.mode]];
 R.forEach((r,i)=>{const yy=256+i*44;cell(40,yy,r[0],r[1]);cell(310,yy,r[2],r[3]);doc.rect(36,yy+36,523,0.6).fill(C.line)});
 T(doc,'Situation financière',36,398,{size:12,font:B});
 [['Total des frais',fmt(total)+' TND',C.navy],['Déjà payé',fmt(paye)+' TND',C.green],['Reste à payer',fmt(reste)+' TND',reste>0?C.orange:C.green]].forEach((c,i)=>{const x=36+i*178;doc.roundedRect(x,418,167,52,10).fillAndStroke(C.cream,C.line);T(doc,c[0].toUpperCase(),x+12,427,{size:8,font:B,color:C.gray,spacing:0.8});T(doc,c[1],x+12,441,{size:15,font:B,color:c[2]})});
 const pct=total>0?Math.round(paye/total*100):100;bar(doc,36,484,523,12,pct,C.green);T(doc,`${pct} % des frais réglés`,36,502,{size:9,color:C.gray,width:523,align:'right'});
 const soldé=reste<=0,sc=soldé?C.green:C.orange;doc.save();doc.rotate(-12,{origin:[460,590]});doc.roundedRect(372,562,176,56,10).lineWidth(3).stroke(sc);
 T(doc,soldé?'PAYÉ EN TOTALITÉ':'ACOMPTE REÇU',372,581,{size:soldé?16:17,font:B,color:sc,width:176,align:'center'});doc.restore();
 const url=(process.env.PUBLIC_URL?`${process.env.PUBLIC_URL}/verifier/${p.id}/${code}`:`Recu ${p.id} code ${code}`);const q=QRCode.create(url,{errorCorrectionLevel:'M'}),n=q.modules.size,cs=96/n;
 doc.roundedRect(36,536,112,112,8).fillAndStroke(C.white,C.line);for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.modules.get(r,c))doc.rect(44+c*cs,544+r*cs,cs+0.15,cs+0.15).fill(C.navy);
 T(doc,"Vérifier l'authenticité de ce reçu",164,548,{size:11,font:B});T(doc,"Scannez le QR code, ou saisissez ce code sur la page de vérification du site de l'école.",164,564,{size:8.5,color:C.gray,width:190,wrap:true});
 T(doc,'CODE',164,596,{size:8,font:B,color:C.gray,spacing:1});T(doc,code,164,607,{size:17,font:B,color:C.navy,spacing:2});
 doc.roundedRect(36,672,260,86,10).lineWidth(0.8).stroke(C.line);T(doc,"Cachet et signature de l'école",48,680,{size:8.5,color:C.gray});
 T(doc,'Merci pour votre confiance.',320,700,{size:13,font:I,color:C.navy2,width:239,align:'right'});T(doc,"L'équipe de l'École Abou El Kacem Chebbi",320,720,{size:9,color:C.gray,width:239,align:'right'});
 pied(doc,'Ce reçu est généré automatiquement. Toute modification du montant ou de la date invalide son code de vérification.');doc.end()}

function bulletinData(db,eleveId,t,annee){const e=db.prepare('SELECT e.*,c.niveau,c.section,u.nom titulaire FROM eleves e LEFT JOIN classes c ON c.id=e.classe_id LEFT JOIN users u ON u.id=c.titulaire_id WHERE e.id=?').get(eleveId);if(!e)return null;
 const m=moyennes(db,eleveId,t,annee),ab=db.prepare('SELECT COUNT(*) total,COALESCE(SUM(justifiee),0) justifiees FROM absences WHERE eleve_id=? AND annee_scolaire=?').get(eleveId,annee);
 const et=db.prepare('SELECT COUNT(*) n FROM felicitations WHERE eleve_id=? AND annee_scolaire=?').get(eleveId,annee).n;return{eleve:e,trimestre:t,annee,m,absences:ab,etoiles:et}}
function recuData(db,id){const p=db.prepare('SELECT * FROM paiements WHERE id=?').get(id);if(!p)return null;const eleve=db.prepare('SELECT nom,prenom,classe_id FROM eleves WHERE id=?').get(p.eleve_id);
 const cl=eleve.classe_id?db.prepare('SELECT niveau,section FROM classes WHERE id=?').get(eleve.classe_id):null;
 const total=db.prepare('SELECT COALESCE(SUM(montant_millimes),0) t FROM frais WHERE eleve_id=? AND annee_scolaire=?').get(p.eleve_id,p.annee_scolaire).t;
 return{p,eleve,classe:cl?`${cl.niveau} ${cl.section}`:'—',total,reste:p.solde_apres_millimes,paye:Math.max(0,total-p.solde_apres_millimes),code:codeRecu(p)}}
module.exports={bulletin,recu,bulletinData,recuData};
