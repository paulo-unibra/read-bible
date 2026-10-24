const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function setup() {
 const data = new Map(); let now = 2000000000000, calls = 0, allowed = true;
 const storage = {getItem:async k=>data.get(k)??null,setItem:async(k,v)=>data.set(k,v)};
 function load() {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('services/InviteVoice.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('exports','require','Date',code)(exports,id=>id.includes('async-storage')?{default:storage}:{playReadingVoice:()=>{calls++;return allowed;}},{now:()=>now});
  return exports.playInviteVoice;
 }
 return {load,advance:n=>now+=n,calls:()=>calls,setAllowed:v=>allowed=v};
}
test('persists cooldown across reloads and allows exactly three hours later',async()=>{
 const s=setup();await s.load()(1,()=>true);assert.equal(s.calls(),1);
 s.advance(10800000-1);await s.load()(1,()=>true);assert.equal(s.calls(),1);
 s.advance(1);await s.load()(1,()=>true);assert.equal(s.calls(),2);
});
test('separates accounts and ignores stale or concurrent screen loads',async()=>{
 const s=setup(),play=s.load();await Promise.all([play(1,()=>true),play(1,()=>true)]);assert.equal(s.calls(),1);
 await play(2,()=>false);assert.equal(s.calls(),1);await play(2,()=>true);assert.equal(s.calls(),2);
});
test('does not consume cooldown when another audio blocks playback',async()=>{
 const s=setup(),play=s.load();s.setAllowed(false);await play(1,()=>true);s.setAllowed(true);await play(1,()=>true);assert.equal(s.calls(),2);
});
