const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function fresh() {
  const output = ts.transpileModule(fs.readFileSync('services/AppFeedback.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('exports', output)(exports);
  return exports;
}
test('queues messages without losing confirmations or executing actions', () => {
  const { default: feedback, feedbackStore: store } = fresh();
  let called = 0;
  const buttons = [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', onPress: () => called++ }];
  feedback.alert('Aviso', 'Primeira mensagem');
  const first = store.current();
  feedback.alert('Excluir plano', 'Confirmar?', buttons, { cancelable: false });
  assert.equal(store.current(), first);
  store.dismiss(first.id);
  assert.equal(store.current().title, 'Excluir plano');
  assert.equal(store.current().buttons, buttons);
  assert.equal(store.current().options.cancelable, false);
  assert.equal(called, 0);
  store.current().buttons[1].onPress();
  assert.equal(called, 1);
});
test('notifies subscribers and safely ignores repeated dismissal', () => {
  const { default: feedback, feedbackStore: store } = fresh();
  let events = 0;
  const unsubscribe = store.subscribe(() => events++);
  feedback.alert('Salvo');
  const id = store.current().id;
  store.dismiss(id);
  store.dismiss(id);
  assert.equal(store.current(), null);
  assert.equal(events, 3);
  unsubscribe();
  feedback.alert('Outra');
  assert.equal(events, 3);
});
