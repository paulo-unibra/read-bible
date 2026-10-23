const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
function compile(file, dependencies = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  const module = { exports: {} };
  new Function('require', 'exports', outputText)(id => {
    if (!(id in dependencies)) throw new Error('Unexpected import ' + id);
    return dependencies[id];
  }, module.exports);
  return module.exports;
}
const engine = compile('utils/tamagoshi.ts');
const { dayKey, nextDay, sleepMinutes, isSleeping, settleTamagoshi, tamagoshiStatus } = engine;
const today = new Date(2026, 9, 23, 12);
const base = () => ({ version: 1, seed: 123, name: 'Lumi', activatedAt: new Date(2026, 9, 20, 10).toISOString(), sleepStart: '22:00', sleepEnd: '06:00', settledThrough: '2026-10-19', health: 60, days: {} });
test('sono atravessa a meia-noite e acorda exatamente no horário', () => {
  assert.equal(sleepMinutes('22:00', '06:00'), 480);
  assert.equal(sleepMinutes('23:30', '06:30'), 420);
  assert.equal(isSleeping(base(), new Date(2026, 9, 23, 22)), true);
  assert.equal(isSleeping(base(), new Date(2026, 9, 24, 5, 59)), true);
  assert.equal(isSleeping(base(), new Date(2026, 9, 24, 6)), false);
  assert.equal(isSleeping({ ...base(), sleepStart: '08:00', sleepEnd: '15:00' }, today), true);
  assert.throws(() => sleepMinutes('25:00', '06:00'));
  assert.throws(() => sleepMinutes('22:99', '06:00'));
});
test('constância recompensa cada dia, volume no mesmo dia não compensa faltas', () => {
  const consistent = base();
  for (const key of ['2026-10-20', '2026-10-21', '2026-10-22']) consistent.days[key] = { reading: true, quiz: false };
  const concentrated = base();
  concentrated.days['2026-10-20'] = { reading: true, quiz: false };
  assert.equal(tamagoshiStatus(consistent, today).health, 78);
  assert.equal(tamagoshiStatus(consistent, today).streak, 3);
  assert.equal(tamagoshiStatus(concentrated, today).health, 56);
  assert.equal(tamagoshiStatus(concentrated, today).streak, 0);
});
test('quiz ajuda mas não substitui leitura e sete horas não perde saúde', () => {
  const pet = { ...base(), sleepStart: '23:00', sleepEnd: '06:00' };
  pet.days['2026-10-21'] = { reading: false, quiz: true };
  assert.equal(tamagoshiStatus(pet, today).health, 52);
  const shortSleep = { ...pet, sleepEnd: '05:59' };
  assert.equal(tamagoshiStatus(shortSleep, today).health, 28);
});
test('hoje não é penalizado, ativação não cobra leitura e liquidação não duplica ganhos', () => {
  const pet = base();
  assert.equal(tamagoshiStatus(pet, new Date(2026, 9, 20, 23, 59)).health, 60);
  pet.days['2026-10-20'] = { reading: true, quiz: true };
  const settled = settleTamagoshi(pet, today);
  assert.deepEqual(settleTamagoshi(settled, today), settled);
  assert.equal(tamagoshiStatus(settled, today).health, 58);
  settled.days[dayKey(today)] = { reading: true, quiz: true };
  assert.equal(tamagoshiStatus(settled, today).health, 66);
});
test('saúde fica entre zero e cem e calendário muda de mês/ano', () => {
  assert.equal(tamagoshiStatus({ ...base(), health: 0 }, today).health, 0);
  const pet = { ...base(), health: 100, settledThrough: nextDay(dayKey(today), -1), days: { [dayKey(today)]: { reading: true, quiz: true } } };
  assert.equal(tamagoshiStatus(pet, today).health, 100);
  assert.equal(nextDay('2026-12-31'), '2027-01-01');
});
function service() {
  const store = new Map();
  const storage = { getItem: async key => store.get(key) ?? null, setItem: async (key, value) => store.set(key, value) };
  const loaded = compile('services/TamagoshiService.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    '../utils/readingCompanion': { getCompanion: () => ({ name: 'Lumi' }) },
    '../utils/tamagoshi': engine,
  });
  return { api: loaded.default, store };
}
test('começa inativo, ativação é idempotente e contas são isoladas', async () => {
  const { api, store } = service();
  await api.record(1, 'reading');
  assert.equal(store.size, 0);
  assert.equal(await api.get(1), null);
  const pet = await api.activate(1);
  assert.deepEqual(await api.activate(1), pet);
  assert.equal(await api.get(2), null);
  assert.equal(sleepMinutes(pet.sleepStart, pet.sleepEnd), 480);
});
test('leituras e quizzes concorrentes persistem, duplicados dão um único bônus diário', async () => {
  const { api } = service();
  await api.activate(1);
  await Promise.all([api.record(1, 'reading'), api.record(1, 'quiz'), api.record(1, 'reading')]);
  const pet = await api.get(1);
  assert.deepEqual(pet.days[dayKey()], { reading: true, quiz: true });
  assert.equal(tamagoshiStatus(pet).health, 68);
  assert.equal(tamagoshiStatus(pet).streak, 1);
});
test('histórico anterior à ativação e datas futuras não criam atividade', async () => {
  const { api } = service();
  await api.activate(1);
  await api.record(1, 'reading', ['2020-01-01T12:00:00Z', 'invalid', '2099-01-01T00:00:00Z']);
  assert.deepEqual((await api.get(1)).days, {});
});
test('configurações persistem sem trocar mascote ou aceitar horários inválidos', async () => {
  const { api } = service();
  const pet = await api.activate(1);
  await api.configure(1, { name: ' Pipo ', sleepStart: '23:00', sleepEnd: '05:00' });
  assert.equal((await api.get(1)).name, 'Pipo');
  assert.equal((await api.get(1)).seed, pet.seed);
  await assert.rejects(api.configure(1, { name: '', sleepStart: '22:00', sleepEnd: '06:00' }));
  await assert.rejects(api.configure(1, { name: 'Pipo', sleepStart: '22:00', sleepEnd: '22:00' }));
});
test('trocar horário não recalcula os dias passados e reiniciar preserva o diário', async () => {
  const { api, store } = service();
  const pet = await api.activate(1);
  const activation = new Date(); activation.setDate(activation.getDate() - 3);
  pet.activatedAt = activation.toISOString();
  pet.settledThrough = nextDay(dayKey(activation), -1);
  store.set('@readbible/tamagoshi/v1/1', JSON.stringify(pet));
  await api.configure(1, { name: 'Lumi', sleepStart: '23:00', sleepEnd: '05:00' });
  const saved = await api.get(1);
  assert.equal(saved.health, 50); // two full missed days, previous eight-hour schedule
  assert.equal(tamagoshiStatus(saved).health, 50); // no advance penalty for today
  const restored = JSON.parse(store.get('@readbible/tamagoshi/v1/1'));
  assert.deepEqual(settleTamagoshi(restored), saved);
});
