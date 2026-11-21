// Utilitaires pour les callbacks asynchrones (map/filter avec await)
const amap=(a,f)=>Promise.all(a.map(f));
const afilter=async(a,f)=>{const k=await Promise.all(a.map(f));return a.filter((_,i)=>k[i])};
module.exports={amap,afilter};
