const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
test('picker includes local, Drive and every API page independently',async()=>{
 const source=fs.readFileSync('app/chapter-reader.tsx','utf8');const start=source.indexOf('  const forceOpenBibleSelector = async () => {');const end=source.indexOf('  const resources =',start);
 const compiled=ts.transpileModule(source.slice(start,end),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const found={};const pages=[];
 const run=new Function('DatabaseService','googleDriveService','bibleBrainService','setBibleSelectorVisible','setCatalogLoading','setAvailableBibles','setAvailableDriveBibles','setApiBibles','Alert',compiled+';return forceOpenBibleSelector;')({getBibles:async()=>[{id:'local'}]},{listBibleFiles:async()=>{throw Error('offline')}},{listBibles:async({page})=>{pages.push(page);return{data:[{bibleId:`api${page}`}],meta:{lastPage:2}}}},()=>{},()=>{},v=>found.local=v,()=>{},v=>found.api=v,{alert:()=>{}});
 await run();assert.deepEqual(pages,[1,2]);assert.equal(found.local[0].id,'local');assert.equal(found.api.length,2);
});
