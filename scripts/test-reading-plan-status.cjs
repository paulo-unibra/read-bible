const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const source = readFileSync(require.resolve('../utils/readingPlanStatus.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
const loaded = { exports: {} };
new Function('exports', compiled.outputText)(loaded.exports);
const { isReadingPlanLate } = loaded.exports;
const plan = { startDate: '2026-10-18T00:00:00Z', totalDays: 440, completedDays: 0 };

for (const [name, changes, days, now, expected] of [
  ['sem leituras após cinco dias', {}, [], new Date(2026, 9, 23), true],
  ['no dia da criação', {}, [], new Date(2026, 9, 18, 23, 59), false],
  ['na virada do dia seguinte', {}, [], new Date(2026, 9, 19), true],
  ['leituras anteriores concluídas', { completedDays: 5 }, [], new Date(2026, 9, 23), false],
  ['leitura adiantada', { completedDays: 8 }, [], new Date(2026, 9, 23), false],
  ['dia anterior parcialmente lido', { completedDays: 5 }, [{ dayNumber: 2, isCompleted: false }], new Date(2026, 9, 23), true],
  ['plano futuro', {}, [], new Date(2026, 9, 17), false],
  ['último dia pendente após término', { totalDays: 4, completedDays: 3 }, [], new Date(2026, 9, 23), true],
  ['plano concluído', { isCompleted: true }, [], new Date(2028, 0, 1), false],
]) {
  test(name, () => assert.equal(isReadingPlanLate({ ...plan, ...changes }, days, now), expected));
}
