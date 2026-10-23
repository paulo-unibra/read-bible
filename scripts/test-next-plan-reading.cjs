const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const source = readFileSync(require.resolve('../utils/nextPlanReading.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const loaded = { exports: {} };
new Function('exports', compiled.outputText)(loaded.exports);
const { getNextPlanReading } = loaded.exports;
const day = (dayNumber, isCompleted = false) => ({ dayNumber, isCompleted });
test('retoma o dia pendente mais antigo, mesmo fora de ordem', () => {
  assert.equal(getNextPlanReading([day(12), day(2), day(1, true), day(3)]).dayNumber, 2);
});
test('avança somente quando a leitura anterior está concluída', () => {
  const days = [day(1), day(2), day(3)];
  assert.equal(getNextPlanReading(days).dayNumber, 1);
  days[0].isCompleted = true;
  assert.equal(getNextPlanReading(days).dayNumber, 2);
});
test('preserva leituras parcialmente concluídas e dias após o fim do cronograma', () => {
  assert.equal(getNextPlanReading([day(364, true), day(365)]).dayNumber, 365);
});
test('sem leitura pendente retorna null', () => {
  assert.equal(getNextPlanReading([]), null);
  assert.equal(getNextPlanReading([day(1, true)]), null);
});
