const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
function load(file) {
  const filename = path.resolve(__dirname, '../utils', file + '.ts');
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)((id) => load(id.replace('./', '')), module, module.exports);
  return module.exports;
}
const { getCompanion, getCompanionState } = load('readingCompanion');
const now = new Date(2026, 9, 23, 12);
const plan = { startDate: '2026-10-18', totalDays: 440, completedDays: 5 };
const quiz = { createdAt: now.toISOString(), correctAnswers: 8, totalQuestions: 10 };
test('refazer um quiz antigo conta como atividade recente', () => {
  const repeated = { ...quiz, createdAt: '2026-02-24T23:55:15Z', lastCompletedAt: now.toISOString() };
  assert.match(getCompanionState(plan, [], [repeated], now).quizText, /1 questionário em 7 dias/);
});
test('companheiro estável por conta, com distribuição entre os quatro mascotes', () => {
  assert.deepEqual(getCompanion(42), getCompanion(42));
  assert.equal(new Set(Array.from({ length: 100 }, (_, i) => getCompanion(i).name)).size, 4);
});
test('leitura e questionários mudam o humor sem esconder atraso', () => {
  assert.equal(getCompanionState(plan, [], [], now).mood, 'happy');
  assert.equal(getCompanionState(plan, [], [quiz], now).mood, 'joyful');
  const late = { ...plan, completedDays: 0 };
  assert.equal(getCompanionState(late, [], [], now).mood, 'sleepy');
  const hopeful = getCompanionState(late, [], [quiz], now);
  assert.equal(hopeful.mood, 'hopeful');
  assert.equal(hopeful.planText, 'Plano atrasado');
});
test('erros em questionários incentivam aprendizado; só usa resultados recentes', () => {
  assert.equal(getCompanionState(plan, [], [{ ...quiz, correctAnswers: 0 }], now).mood, 'happy');
  for (const createdAt of ['2026-10-01', '2027-01-01', 'invalid']) {
    assert.equal(getCompanionState(plan, [], [{ ...quiz, createdAt }], now).mood, 'happy');
  }
});
test('sem plano, concluído e falha de rede são estados distintos', () => {
  assert.equal(getCompanionState(null, [], [], now).mood, 'curious');
  assert.equal(getCompanionState(null, [], [quiz], now).mood, 'happy');
  assert.equal(getCompanionState({ ...plan, isCompleted: true }, [], [], now).mood, 'joyful');
  assert.match(getCompanionState(plan, [], null, now).quizText, /indisponíveis/);
});
