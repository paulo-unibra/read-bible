const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const entry = position => ({ position, userId: position, name: `Pet ${position}`, seed: position, catalogVersion: 2, points: 100 - position });
const page = (number = 1, hasMore = true, month = '2026-10') => ({ month, page: number, hasMore,
  entries: Array.from({ length: number === 1 ? 15 : 10 }, (_, i) => entry(number === 1 ? i + 1 : 6 + (number - 1) * 10 + i)),
  own: { position: 1, points: 99 }, resetsAt: '2026-11-01T03:00:00Z' });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(ranking, initial = page()) {
  const states = [initial, false, false, 0, false, false, { name: 'Pet 1', seed: 1, catalogVersion: 2 }, false];
  let cursor = 0;
  let effects = [];
  const updates = [];
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(value) {
      const index = cursor++;
      if (!(index in states)) states[index] = value;
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; updates.push(index); }];
    },
    useRef(value) { const index = cursor++; if (!(index in states)) states[index] = { current: value }; return states[index]; },
    useCallback: fn => fn,
  };
  const dependencies = {
    react: { ...react, __esModule: true, default: react },
    'expo-router': { useRouter: () => ({ replace() {}, back() {} }), useFocusEffect: fn => effects.push(fn) },
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', ActivityIndicator: 'Spinner', FlatList: 'List', StyleSheet: { create: value => value } },
    'react-native-safe-area-context': { SafeAreaView: 'View' },
    '@expo/vector-icons': { Ionicons: 'Icon' },
    '../components/CompanionAvatar': { __esModule: true, default: 'Avatar' },
    '../constants/design': { getFocusColors: () => new Proxy({}, { get: () => '#123456' }) },
    '../services/AuthService': { __esModule: true, default: { init: async () => {}, getUser: () => ({ id: 1 }) } },
    '../services/DatabaseService': { __esModule: true, default: { getSetting: async () => null } },
    '../services/TamagoshiService': { __esModule: true, default: { ranking, sync: async () => states[6] } },
    '../utils/tamagoshi': { dayKey: () => '2026-10-23', isTamagoshiPodium: n => n >= 1 && n <= 5, tamagoshiDisplayName: name => name },
  };
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync('app/tamagoshi-ranking.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  new Function('require', 'exports', compiled)(id => {
    if (!(id in dependencies)) throw new Error(`Unexpected import: ${id}`);
    return dependencies[id];
  }, module.exports);
  const find = (node, type) => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === type) return node;
    for (const child of (node.props?.children ?? []).flat(Infinity)) { const found = find(child, type); if (found) return found; }
    return null;
  };
  return { states, updates, focus: () => effects[1](), render() {
    cursor = 0; effects = [];
    const tree = module.exports.default();
    return find(tree, 'List')?.props;
  } };
}
test('scroll requests one page at a time and appends ten entries; stops at the end', async () => {
  const pending = deferred(); const calls = [];
  const h = harness(number => { calls.push(number); return pending.promise; });
  let list = h.render();
  assert.equal(list.data.length, 10);
  assert.equal(list.ListFooterComponent, undefined);
  list.onEndReached(); list.onEndReached();
  assert.deepEqual(calls, [2]);
  assert.equal(h.render().ListFooterComponent.props.children[0].type, 'Spinner');
  pending.resolve(page(2, false)); await flush();
  list = h.render();
  assert.equal(list.data.length, 20);
  assert.deepEqual(list.data.map(row => row.position), Array.from({ length: 20 }, (_, i) => i + 6));
  assert.equal(list.ListFooterComponent, undefined);
  list.onEndReached(); assert.deepEqual(calls, [2]);
});
test('failure preserves the list and waits for an explicit retry instead of looping', async () => {
  const calls = [];
  const h = harness(number => { calls.push(number); return calls.length === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(page(2, false)); });
  h.render().onEndReached(); await flush();
  const list = h.render();
  assert.equal(list.data.length, 10);
  list.onEndReached(); await flush();
  assert.deepEqual(calls, [2]);
  assert.equal(list.ListFooterComponent.type, 'Button');
  list.ListFooterComponent.props.onPress(); await flush();
  assert.deepEqual(calls, [2, 2]);
  assert.equal(h.render().data.length, 20);
});
test('a response received after leaving the screen cannot change its data', async () => {
  const pending = deferred();
  const h = harness(number => number === undefined ? Promise.resolve(page()) : pending.promise);
  h.render(); const leave = h.focus(); await flush();
  h.render().onEndReached();
  leave(); const count = h.updates.length;
  pending.resolve(page(2)); await flush();
  assert.equal(h.states[0].page, 1);
  assert.equal(h.updates.length, count);
});
test('month rollover refreshes the ranking without mixing months', async () => {
  const h = harness(() => Promise.resolve(page(2, false, '2026-11')));
  h.render().onEndReached(); await flush();
  assert.equal(h.states[0].month, '2026-10');
  assert.equal(h.states[0].entries.length, 15);
  assert.equal(h.states[3], 1);
});
