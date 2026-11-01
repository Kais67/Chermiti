// Montant en toutes lettres (français) : « quatre cents dinars et cinq cents millimes »
const U=['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize'];
const D=['','','vingt','trente','quarante','cinquante','soixante'];
const petit=r=>r<17?U[r]:'dix-'+U[r-10];
function moins100(n){if(n<17)return U[n];if(n<20)return 'dix-'+U[n-10];
 if(n<70){const d=Math.floor(n/10),u=n%10;return D[d]+(u===1?' et un':u?'-'+U[u]:'')}
 if(n<80){const r=n-60;return r===11?'soixante et onze':'soixante-'+petit(r)}
 const r=n-80;return r===0?'quatre-vingts':'quatre-vingt-'+petit(r)}
function moins1000(n,final){const c=Math.floor(n/100),r=n%100;let s='';
 if(c){s=c===1?'cent':U[c]+' cent';if(r===0&&c>1&&final)s+='s'}
 if(r)s+=(s?' ':'')+moins100(r);return s}
function nombre(n){if(n===0)return 'zéro';const mil=Math.floor(n/1000),r=n%1000;let s='';
 if(mil){s=mil===1?'mille':moins1000(mil,false).replace(/quatre-vingts$/,'quatre-vingt')+' mille'}
 if(r)s+=(s?' ':'')+moins1000(r,true);return s}
function montantEnLettres(millimes){const d=Math.floor(millimes/1000),m=millimes%1000;const parts=[];
 if(d>0||m===0)parts.push(`${nombre(d)} dinar${d>1?'s':''}`);if(m>0)parts.push(`${nombre(m)} millime${m>1?'s':''}`);
 const s=parts.join(' et ');return s.charAt(0).toUpperCase()+s.slice(1)}
module.exports={nombre,montantEnLettres};
