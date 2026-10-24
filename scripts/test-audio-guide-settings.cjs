const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
test('guides default off and persist explicit activation and deactivation',async()=>{
 const data=new Map();const storage={getItem:async k=>data.get(k)??null,setItem:async(k,v)=>data.set(k,v)};
 function load(){const exports={};const code=ts.transpileModule(fs.readFileSync('services/AudioGuideSettings.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;new Function('exports','require',code)(exports,()=>({__esModule:true,default:storage}));return exports.audioGuideSettings;}
 const prefs=load();assert.equal(prefs.isEnabled(),false);assert.equal(await prefs.load(),false);
 await prefs.setEnabled(true);assert.equal(await load().load(),true);
 let notified=0;prefs.subscribe(()=>notified++);await prefs.setEnabled(false);assert.equal(notified,1);assert.equal(await load().load(),false);
});
