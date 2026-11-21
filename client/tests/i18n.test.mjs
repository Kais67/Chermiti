// Test du moteur de traduction (sans navigateur) : npm test
import test from 'node:test';import assert from 'node:assert';import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';
const d=path.dirname(fileURLToPath(import.meta.url)),I=path.join(d,'../src/i18n');
globalThis.localStorage={_:{},getItem(k){return this._[k]||null},setItem(k,v){this._[k]=v}};
const base=fs.readFileSync(path.join(I,'index.jsx'),'utf8').replace(/import\{createContext[^\n]*\n/,'').replace(/import ar[^\n]*\n/,`const ar=JSON.parse(fs.readFileSync(${JSON.stringify(path.join(I,'ar.json'))},'utf8')),en=JSON.parse(fs.readFileSync(${JSON.stringify(path.join(I,'en.json'))},'utf8'));\n`).split('const Ctx=')[0];
const tmp=path.join(fs.mkdtempSync(path.join(process.env.TMPDIR||'/tmp','i18n-')),'core.mjs');fs.writeFileSync(tmp,'import fs from "fs";'+base);
const charger=async l=>{localStorage._.lang=l;return import(tmp+'?'+l+Math.random())};
test('français par défaut, variables, repli sur le français',async()=>{const m=await charger('fr');assert.equal(m.tt('Bonjour {nom} 👋',{nom:'Sami'}),'Bonjour Sami 👋');assert.equal(m.tt('Texte inconnu'),'Texte inconnu')});
test('arabe : traduction, direction RTL, messages du serveur avec valeurs',async()=>{const m=await charger('ar');assert.equal(m.LANGS.ar.dir,'rtl');assert.equal(m.tt('Enregistrer'),'حفظ');
 assert.match(m.tr_serveur('Le montant dépasse le solde restant (12.500 TND)'),/12\.500 د\.ت/);assert.equal(m.tt('Inconnu total'),'Inconnu total')});
test('anglais : traduction et motifs du serveur',async()=>{const m=await charger('en');assert.equal(m.tt('Enregistrer'),'Save');assert.equal(m.tr_serveur('Accès refusé'),'Access denied');assert.equal(m.LANGS.en.dir,'ltr')});
test('catalogues : mêmes variables {…} dans chaque traduction',()=>{for(const l of['ar','en']){const c=JSON.parse(fs.readFileSync(path.join(I,l+'.json'),'utf8'));for(const[k,v]of Object.entries(c)){const p=s=>[...s.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort().join();assert.equal(p(v),p(k),`${l}: variables différentes pour « ${k} »`)}}});
