// Thèmes par matière (couleur + pictogramme) et appréciations en symboles (pour les parents peu lecteurs)
const PALETTE={vert:'#2f8f77',bleu:'#2f6fb5',orange:'#e8852b',violet:'#7a55b3',or:'#c99700',rouge:'#d9482b',rose:'#d8588c',turquoise:'#1f9aa8',gris:'#6b7280'};
const ICONES=['livre','crayon','calcul','science','croissant','globe','sport','musique','art','etoile'];
function parDefaut(nom=''){const n=String(nom).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const t=[[/arab/,'livre','vert'],[/fran/,'crayon','bleu'],[/math|calcul/,'calcul','orange'],[/eveil|scien|nature/,'science','violet'],[/islam|religi|coran/,'croissant','or'],[/angl|langue|geo|histoire|civique/,'globe','turquoise'],[/sport|physique|eps/,'sport','rouge'],[/musiq|chant/,'musique','rose'],[/dessin|art|plastique|manuel/,'art','rose']];
 for(const[re,i,c]of t)if(re.test(n))return{icone:i,couleur:PALETTE[c]};return{icone:'etoile',couleur:PALETTE.gris}}
function theme(m){const d=parDefaut(m.nom);return{icone:ICONES.includes(m.icone)?m.icone:d.icone,couleur:Object.values(PALETTE).includes(m.couleur)?m.couleur:d.couleur}}
function appreciation(moy){if(moy===null||moy===undefined)return null;
 if(moy>=16)return{label:'Excellent',etoiles:3,couleur:'#1f7a5c',symbole:'😀'};if(moy>=14)return{label:'Très bien',etoiles:2,couleur:'#2f8f77',symbole:'😀'};
 if(moy>=12)return{label:'Bien',etoiles:1,couleur:'#2f6fb5',symbole:'🙂'};if(moy>=10)return{label:'Assez bien',etoiles:0,couleur:'#c99700',symbole:'😐'};
 if(moy>=8)return{label:'À renforcer',etoiles:0,couleur:'#e8852b',symbole:'😟'};return{label:"Besoin d'aide",etoiles:0,couleur:'#d9482b',symbole:'🤝'}}
module.exports={PALETTE,ICONES,theme,appreciation,parDefaut};
