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
test('navigation clears toasts and confirmations without running their callbacks', () => {
  const { default: feedback, feedbackStore: store } = fresh();
  let actions = 0;
  let events = 0;
  store.subscribe(() => events++);
  feedback.alert('Confirmar', 'Mensagem', [{ text: 'Sim', onPress: () => actions++ }], { onDismiss: () => actions++ });
  const oldId = store.current().id;
  store.clear();
  assert.equal(store.current(), null);
  assert.equal(actions, 0);
  assert.equal(events, 2);
  store.clear();
  assert.equal(events, 2);
  feedback.alert('Mensagem da nova tela');
  store.dismiss(oldId);
  assert.equal(store.current().title, 'Mensagem da nova tela');
  store.clear();
  assert.equal(store.current(), null);
});
test('replaces a toast immediately with a confirmation without executing actions', () => {
  const { default: feedback, feedbackStore: store } = fresh();
  let called = 0;
  const buttons = [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', onPress: () => called++ }];
  feedback.alert('Aviso', 'Primeira mensagem');
  const first = store.current();
  feedback.alert('Excluir plano', 'Confirmar?', buttons, { cancelable: false });
  assert.notEqual(store.current(), first);
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
  assert.equal(events, 2);
  unsubscribe();
  feedback.alert('Outra');
  assert.equal(events, 2);
});

test('a new toast replaces a confirmation and stale timers cannot dismiss it', () => {
  const { default: feedback, feedbackStore: store } = fresh();
  let actions = 0;
  feedback.alert('Excluir?', '', [{ text: 'Excluir', onPress: () => actions++ }], { onDismiss: () => actions++ });
  const oldId = store.current().id;
  feedback.alert('Leitura pendente', 'Conclua o dia anterior.');
  const latest = store.current();
  store.dismiss(oldId);
  assert.equal(store.current(), latest);
  assert.equal(actions, 0);
  store.dismiss(latest.id);
  assert.equal(store.current(), null);
});
