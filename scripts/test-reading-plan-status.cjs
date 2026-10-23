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
const { isReadingPlanLate, getReadingPlanLateDays } = loaded.exports;
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

for (const [name, changes, days, now, expected] of [
  ['cinco dias vencidos sem leitura', {}, [], new Date(2026, 9, 23), 5],
  ['dia de criação ainda não venceu', {}, [], new Date(2026, 9, 18, 23, 59), 0],
  ['um dia vencido na virada', {}, [], new Date(2026, 9, 19), 1],
  ['duas leituras quitam dois dos cinco dias vencidos', { completedDays: 2 }, [], new Date(2026, 9, 23), 3],
  ['dias adiantados não apagam lacunas antigas', { completedDays: 5 }, [
    { dayNumber: 4, isCompleted: false }, { dayNumber: 5, isCompleted: false },
    { dayNumber: 6, isCompleted: true }, { dayNumber: 7, isCompleted: true },
  ], new Date(2026, 9, 23), 2],
  ['plano encerrado limita atraso a leituras pendentes', { totalDays: 4, completedDays: 3 }, [], new Date(2028, 0, 1), 1],
  ['plano futuro não tem dias vencidos', {}, [], new Date(2026, 9, 17), 0],
  ['plano concluído não tem atraso', { isCompleted: true }, [], new Date(2028, 0, 1), 0],
]) {
  test(name, () => assert.equal(getReadingPlanLateDays({ ...plan, ...changes }, days, now), expected));
}
