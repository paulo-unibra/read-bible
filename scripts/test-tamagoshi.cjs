const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
function compile(file, dependencies = {}, fetcher = global.fetch) {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  const module = { exports: {} };
  new Function('require', 'exports', 'fetch', outputText)(id => {
    if (!(id in dependencies)) throw new Error('Unexpected import ' + id);
    return dependencies[id];
  }, module.exports, fetcher);
  return module.exports;
}
const engine = compile('utils/tamagoshi.ts');
const { dayKey, nextDay, TAMAGOSHI_SLEEP, isSleeping, settleTamagoshi, tamagoshiStatus, tamagoshiDisplayName } = engine;
const base = () => ({ version: 1, seed: 123, name: 'Lumi', activatedAt: '2026-10-20T15:00:00Z', sleepStart: '22:00', sleepEnd: '06:00', health: 100, days: {} });
const score = { month: '2026-10', points: 126, readingDays: ['2026-10-31'], quizDays: [], readToday: true, quizToday: false };
test('leituras removidas não sobrevivem no cache nem mantêm a expressão feliz', () => {
  const pet = { ...base(), days: { '2026-10-31': { reading: true, quiz: false } },
    monthlyScore: { ...score, points: 2, readingDays: [], readingHistory: [], readToday: false } };
  const status = tamagoshiStatus(pet, new Date('2026-10-31T15:00:00Z'));
  assert.equal(status.points, 2);
  assert.equal(status.readToday, false);
  assert.equal(status.streak, 0);
  assert.notEqual(status.mood, 'happy');
  assert.notEqual(status.mood, 'joyful');
});
test('sono fixo começa às 22h e termina às 6h no relógio local', () => {
  assert.deepEqual(TAMAGOSHI_SLEEP, { start: '22:00', end: '06:00' });
  assert.equal(isSleeping(new Date(2026, 9, 23, 21, 59)), false);
  assert.equal(isSleeping(new Date(2026, 9, 23, 22)), true);
  assert.equal(isSleeping(new Date(2026, 9, 24, 5, 59)), true);
  assert.equal(isSleeping(new Date(2026, 9, 24, 6)), false);
});
test('virada mensal segue Recife e não a meia-noite UTC', () => {
  const pet = { ...base(), monthlyScore: score };
  assert.equal(dayKey(new Date('2026-11-01T02:59:59Z')), '2026-10-31');
  assert.equal(tamagoshiStatus(pet, new Date('2026-11-01T02:59:59Z')).points, 126);
  assert.equal(tamagoshiStatus(pet, new Date('2026-11-01T03:00:00Z')).points, 0);
  assert.equal(nextDay('2026-12-31'), '2027-01-01');
});
test('pontuação só vem do servidor, sem limite de cem nem redução por inatividade', () => {
  assert.equal(tamagoshiStatus(base(), new Date('2026-10-31T15:00:00Z')).points, 0);
  const pet = { ...base(), monthlyScore: score, days: { '2026-10-31': { reading: true, quiz: true } } };
  assert.equal(tamagoshiStatus(pet, new Date('2026-10-31T15:00:00Z')).points, 126);
  assert.equal(settleTamagoshi(pet).health, undefined);
});
test('sequência de leitura continua entre meses e emoções usam constância', () => {
  const pet = { ...base(), days: { '2026-10-31': { reading: true, quiz: false }, '2026-11-01': { reading: true, quiz: false } }, monthlyScore: score };
  const state = tamagoshiStatus(pet, new Date('2026-11-01T15:00:00Z'));
  assert.equal(state.points, 0);
  assert.equal(state.streak, 2);
  assert.equal(state.mood, 'happy');
});
test('nome completo usa só o primeiro nome do usuário e não duplica sufixo', () => {
  assert.equal(tamagoshiDisplayName('Lumi', 'Paulo Roberto'), 'Lumi Paulo');
  assert.equal(tamagoshiDisplayName('Pipo', '  Ana   Maria  '), 'Pipo Ana');
  assert.equal(tamagoshiDisplayName('Lumi Paulo', 'Paulo Roberto'), 'Lumi Paulo');
  assert.equal(tamagoshiDisplayName('Pérola', 'Érica Silva'), 'Pérola Érica');
  assert.equal(tamagoshiDisplayName('Lumi', null), 'Lumi');
});
function service() {
  const store = new Map(); const server = new Map(); const requests = [];
  const session = { id: 1, offline: false };
  const storage = { getItem: async key => store.get(key) ?? null, setItem: async (key, value) => store.set(key, value) };
  const fetcher = async (url, options) => {
    if (session.offline) throw new Error('offline');
    const id = Number(options.headers.Authorization.split('-')[1]);
    const body = options.body ? JSON.parse(options.body) : {};
    requests.push({ url, body });
    const row = server.get(id) ?? { profile: null, score: { month: dayKey().slice(0, 7), points: 0, readingDays: [], quizDays: [], readToday: false, quizToday: false } };
    if (url.endsWith('/activate') && !row.profile) row.profile = { ...body, activatedAt: new Date().toISOString() };
    if (options.method === 'PUT') row.profile.name = body.name;
    if (url.endsWith('/reading') && !row.score.readingDays.includes(dayKey())) {
      row.score.points += 6; row.score.readingDays.push(dayKey()); row.score.readToday = true;
    }
    server.set(id, row);
    return Response.json({ success: true, data: row });
  };
  const loaded = compile('services/TamagoshiService.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    './AuthService': { __esModule: true, API_URL: 'https://example.invalid/api', default: { getUser: () => ({ id: session.id }), getToken: () => `token-${session.id}` } },
    '../utils/readingCompanion': { getCompanion: () => ({ name: 'Lumi' }) }, '../utils/tamagoshi': engine,
  }, fetcher);
  return { api: loaded.default, store, server, session, requests };
}
test('começa inativo, ativação é idempotente, contas isoladas e zero pontos iniciais', async () => {
  const { api } = service();
  assert.equal(await api.get(1), null);
  const pet = await api.activate(1);
  assert.deepEqual(await api.activate(1), pet);
  assert.equal(await api.get(2), null);
  assert.equal(tamagoshiStatus(pet).points, 0);
});
test('saúde antiga não é transferida, nome/aparência permanecem e sono é fixado', async () => {
  const { api, store, requests } = service();
  const old = { ...base(), sleepStart: '10:00', sleepEnd: '12:00', claimedInvitePoints: 500 };
  store.set('@readbible/tamagoshi/v1/1', JSON.stringify(old));
  const pet = await api.sync(1);
  assert.equal(pet.health, undefined);
  assert.equal(pet.claimedInvitePoints, undefined);
  assert.equal(pet.sleepStart, '22:00');
  assert.equal(pet.seed, old.seed);
  assert.equal(pet.name, old.name);
  assert.equal(tamagoshiStatus(pet).points, 0);
  assert.equal(requests.find(row => row.url.endsWith('/activate')).body.points, undefined);
});
test('leitura offline fica pendente e sincroniza uma única vez no mesmo dia', async () => {
  const { api, session } = service();
  await api.activate(1); session.offline = true;
  assert.equal((await api.record(1, 'reading')).synced, false);
  assert.equal(tamagoshiStatus(await api.get(1)).points, 0);
  session.offline = false;
  const saved = await api.sync(1);
  assert.equal(tamagoshiStatus(saved).points, 6);
  assert.equal(saved.pendingReadingDay, undefined);
  await api.sync(1);
  assert.equal(tamagoshiStatus(await api.get(1)).points, 6);
});
test('cliente não cria pontos de quiz sem resultado confirmado no servidor', async () => {
  const { api } = service(); await api.activate(1);
  await api.record(1, 'quiz');
  assert.equal(tamagoshiStatus(await api.get(1)).points, 0);
});
test('pendências de leitura de dias anteriores não são creditadas no dia atual', async () => {
  const { api, store, requests } = service(); const pet = await api.activate(1);
  pet.pendingReadingDay = nextDay(dayKey(), -1);
  store.set('@readbible/tamagoshi/v1/1', JSON.stringify(pet));
  const saved = await api.sync(1);
  assert.equal(saved.pendingReadingDay, undefined);
  assert.equal(requests.some(row => row.url.endsWith('/reading')), false);
});
test('perfil remoto é recuperado em outro aparelho e nome continua editável', async () => {
  const { api, store } = service(); const pet = await api.activate(1); await api.sync(1);
  store.clear();
  const restored = await api.sync(1);
  assert.equal(restored.seed, pet.seed);
  assert.equal((await api.configure(1, { name: ' Pipo ' })).name, 'Pipo');
  await assert.rejects(api.configure(1, { name: '' }));
});
test('sincronização retira do armazenamento leituras desmarcadas no servidor', async () => {
  const { api, store, server } = service();
  await api.activate(1);
  await api.record(1, 'reading');
  const row = server.get(1);
  row.score = { ...row.score, points: 0, readingDays: [], readingHistory: [], readToday: false };
  const saved = await api.sync(1);
  assert.equal(saved.days[dayKey()].reading, false);
  assert.equal(tamagoshiStatus(saved).streak, 0);
  assert.equal(tamagoshiStatus(saved).points, 0);
  assert.equal(JSON.parse(store.get('@readbible/tamagoshi/v1/1')).days[dayKey()].reading, false);
});
