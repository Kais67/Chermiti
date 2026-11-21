// Extrait les textes français traduisibles : tt('…') dans le client + messages d'erreur du serveur.
//   node scripts/i18n-cles.cjs            → liste les clés
//   node scripts/i18n-cles.cjs --verifier → rapport de complétude des catalogues ar/en (échec si incomplet avec --strict)
const fs=require('fs'),path=require('path');let j;try{j=require('jscodeshift').withParser('tsx')}catch{console.error('Installer jscodeshift (npm i -D jscodeshift)');process.exit(1)}
const SRC=path.join(__dirname,'../src'),SRV=path.join(__dirname,'../../server/src');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const cles=new Set();
for(const f of walk(SRC).filter(f=>/\.jsx?$/.test(f)))j(fs.readFileSync(f,'utf8')).find(j.CallExpression,{callee:{type:'Identifier',name:'tt'}}).forEach(p=>{const a=p.node.arguments[0];if(a&&(a.type==='StringLiteral'||a.type==='Literal')&&typeof a.value==='string')cles.add(a.value)});
// Libellés traduits dynamiquement par les composants (BI.jsx) : props l/t/aide/vide, colonnes ['Libellé',fn], onglets ['id','icône','Libellé']
for(const f of walk(SRC).filter(f=>/BI\.jsx$/.test(f))){const r=j(fs.readFileSync(f,'utf8')),add=v=>{if(typeof v==='string'&&/[A-Za-zÀ-ÿ]{2,}/.test(v))cles.add(v)};
 r.find(j.JSXAttribute).forEach(p=>{const n=p.node.name.name,v=p.node.value;if(['l','t','aide','vide'].includes(n)&&v&&(v.type==='StringLiteral'||v.type==='Literal'))add(v.value)});
 r.find(j.ArrayExpression).forEach(p=>{const e=p.node.elements;if(e.length===2&&(e[0].type==='StringLiteral'||e[0].type==='Literal')&&e[1].type==='ArrowFunctionExpression')add(e[0].value);
  if(e.length===3&&e.every(x=>x.type==='StringLiteral'||x.type==='Literal'))add(e[2].value)})}
const serveur=new Set();
for(const f of walk(SRV).filter(f=>/\.js$/.test(f))){const s=fs.readFileSync(f,'utf8');
 j(s).find(j.CallExpression).forEach(p=>{const c=p.node.callee;if(c.type==='Identifier'&&c.name==='err'&&p.node.arguments[1]){const a=p.node.arguments[1];
  if(a.type==='StringLiteral'||a.type==='Literal')serveur.add(a.value);else if(a.type==='TemplateLiteral'){let k=a.quasis[0].value.cooked;a.expressions.forEach((e,i)=>k+='{'+(['n','m','x','y','z'][i]||'v'+i)+'}'+a.quasis[i+1].value.cooked);serveur.add(k)}}});
 j(s).find(j.ObjectProperty,{key:{name:'erreur'}}).forEach(p=>{const a=p.node.value;if(a.type==='StringLiteral')serveur.add(a.value)})}
const tout=[...new Set([...cles,...serveur])].filter(k=>/[A-Za-zÀ-ÿ]{2,}/.test(k)).sort();
if(process.argv.includes('--verifier')){let ko=0;for(const l of['ar','en']){const c=JSON.parse(fs.readFileSync(path.join(SRC,'i18n',l+'.json'),'utf8'));const m=tout.filter(k=>!c[k]);const orph=Object.keys(c).filter(k=>!tout.includes(k));
 console.log(`${l}: ${tout.length-m.length}/${tout.length} traduits (${Math.round(100*(tout.length-m.length)/tout.length)} %)${orph.length?`, ${orph.length} clés orphelines`:''}`);if(m.length&&process.argv.includes('--liste'))console.log(m.join('\n'));ko+=m.length}
 if(ko&&process.argv.includes('--strict'))process.exit(1)}
else fs.writeFileSync(process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:'/dev/stdout',JSON.stringify(tout,null,1));
