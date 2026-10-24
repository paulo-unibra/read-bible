const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
function load(name) {
 const exports = {};
 const code = ts.transpileModule(fs.readFileSync(`utils/${name}.ts`, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('exports', 'require', code)(exports, id => load(id.replace('./','')));
 return exports;
}
const {planGreeting,greetingDayKey} = load('planGreeting');
const now = new Date(2026,9,24,12);
const makePlan = n => ({startDate:`2026-10-${24-n}`,totalDays:30,completedDays:0});
test('uses exact count up to five and generic resumption beyond five',()=>{
 for(let n=1;n<=5;n++)assert.equal(planGreeting(makePlan(n),[],now),`late_${n}`);
 assert.equal(planGreeting(makePlan(6),[],now),'resume');
});
test('distinguishes unread today from actual completion',()=>{
 assert.equal(planGreeting(makePlan(0),[],now),'today');
 assert.equal(planGreeting(makePlan(0),[{isCompleted:true,completedDate:now.toISOString()}],now),'completed');
});
test('daily guard separates accounts and calendar days',()=>{
 assert.notEqual(greetingDayKey(1,now),greetingDayKey(2,now));
 assert.notEqual(greetingDayKey(1,now),greetingDayKey(1,new Date(2026,9,25)));
});
