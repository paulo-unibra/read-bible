const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
function setup(enabled=true){let state={currentState:'active',addEventListener:()=>{}};const players=[];const exports={};const code=ts.transpileModule(fs.readFileSync('services/ReadingVoice.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;new Function('exports','require',code)(exports,id=>id.includes('AudioGuideSettings')?{audioGuideSettings:{isEnabled:()=>enabled,subscribe:()=>{}}}:id==='react-native'?{AppState:state}:id==='expo-audio'?{createAudioPlayer:(source)=>{const p={source,play(){this.played=true},remove(){this.removed=true},addListener(_,fn){this.finish=fn}};players.push(p);return p}}:id);return{exports,players,state}}
test('keeps current voice and ignores repeated actions until it finishes',()=>{
 const {exports:v,players}=setup();
 v.playReadingVoice('reading');
 v.playReadingVoice('reading');
 v.playReadingVoice('planCompleted');
 assert.equal(players.length,1);
 assert.equal(players[0].removed,undefined);
 players[0].finish({didJustFinish:true});
 assert.equal(players[0].removed,true);
 v.playReadingVoice('reading');
 assert.equal(players.length,2);
 assert.equal(players[1].played,true);
 assert.equal(v.hasRecentReadingVoice(),true);
});
test('does not start audio in background',()=>{const{exports:v,players,state}=setup();state.currentState='background';v.playReadingVoice('quiz');assert.equal(players.length,0)});

test('uses all ten variations before repeating, including across cycles',()=>{
 const {exports:v,players}=setup();
 for(let i=0;i<30;i++){v.playReadingVoice('reading');players[i].finish({didJustFinish:true});}
 for(let i=0;i<30;i+=10)assert.equal(new Set(players.slice(i,i+10).map(p=>p.source)).size,10);
 for(let i=1;i<30;i++)assert.notEqual(players[i].source,players[i-1].source);
 for(const p of players)assert.match(p.source,/leitura_concluida_\d+\.mp3$/);
});

test('playback failure releases the lock for a later action',()=>{
 const {exports:v,players}=setup();
 v.playReadingVoice('reading');players[0].finish({error:'failed'});
 v.playReadingVoice('quiz');assert.equal(players.length,2);
});

test('disabled guides never create a player',()=>{const {exports:v,players}=setup(false);assert.equal(v.playReadingVoice('reading'),false);assert.equal(v.playReadingVoice('invite'),false);assert.equal(players.length,0)});
