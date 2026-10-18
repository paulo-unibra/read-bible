const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTs(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const localRequire = createRequire(filename);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'console', outputText)(
    (id) => Object.hasOwn(mocks, id) ? mocks[id] : localRequire(id),
    module,
    module.exports,
    { log() {}, error: console.error },
  );
  return module.exports;
}

const apiRequire = createRequire(path.resolve(__dirname, '../api/package.json'));
const { DateTime, Settings } = apiRequire('luxon');
const apiPeriod = loadTs('api/app/utils/annual_reading_period.ts');
const appPeriod = loadTs('utils/annualReadingPeriod.ts');

for (const [date, year, days] of [
  ['2026-10-02', 2026, 91],
  ['2026-10-03', 2026, 90],
  ['2026-10-04', 2027, 454],
  ['2026-10-18', 2027, 440],
  ['2026-12-31', 2027, 366],
  ['2027-01-01', 2027, 365],
  ['2027-10-18', 2028, 441],
  ['2028-01-01', 2028, 366],
]) {
  test(`app e API concordam para ${date}`, () => {
    for (const hour of [0, 12, 23]) {
      const [y, m, d] = date.split('-').map(Number);
      const app = appPeriod.getAnnualReadingPeriod(new Date(y, m - 1, d, hour));
      const api = apiPeriod.getAnnualReadingPeriod(DateTime.local(y, m, d, hour));
      assert.equal(app.planYear, year);
      assert.equal(api.planYear, year);
      assert.equal(app.totalDays, days);
      assert.equal(api.totalDays, days);
      assert.equal(app.startDate.getDate(), d);
      assert.equal(api.startDate.day, d);
    }
  });
}

test('rotas aplicam a regra, aceitam clientes antigos e preservam duração própria', async () => {
  const saved = [];
  const query = { where() { return this; }, whereNull() { return this; }, async first() { return null; } };
  const ReadingPlan = {
    query: () => query,
    async create(data) {
      saved.push(data);
      return { ...data, id: 1, async save() {} };
    },
  };
  const Controller = loadTs('api/app/controllers/reading_plan_controller.ts', {
    '#models/reading_plan': { default: ReadingPlan },
    '#models/reading_progress': { default: {} },
    '#models/audit_log': { default: { async create() {} } },
    '@adonisjs/lucid/services/db': { default: {} },
    '../utils/annual_reading_period.js': apiPeriod,
    '../utils/bible_verses_per_chapter.js': {},
  }).default;
  const controller = new Controller();
  controller.generateDayReadings = async () => [];
  controller.generateDailyProgress = async () => {};
  const response = { created: (body) => body, badRequest: (body) => { throw new Error(body.error); } };
  const context = (payload) => ({
    auth: { user: { id: 1 } }, response,
    request: { only: () => payload, ip: () => '127.0.0.1', header: () => undefined },
  });

  const previousNow = Settings.now;
  const fixedNow = DateTime.fromISO('2026-10-18T12:00:00Z').toMillis();
  Settings.now = () => fixedNow;
  try {
    for (const method of ['create', 'createBeginner']) {
      await controller[method](context({}));
      assert.equal(saved.at(-1).endDate.year, 2027);
      assert.equal(saved.at(-1).totalDays, 440);
    }
    for (const type of ['sequential', 'interleaved', 'annual']) {
      for (const [startDate, endDate, totalDays, expectedEnd, expectedDays] of [
        ['2026-10-18T03:00:00Z', '2027-01-01T02:59:59Z', 75, '2028-01-01', 440],
        ['2026-10-18T00:00:00Z', '2026-12-31T23:59:59Z', 75, '2027-12-31', 440],
        ['2026-10-03T00:00:00Z', '2026-12-31T23:59:59Z', 90, '2026-12-31', 90],
        ['2026-10-18T03:00:00Z', '2028-01-01T02:59:59Z', 440, '2028-01-01', 440],
        ['2026-10-18T00:00:00Z', '2027-01-26T00:00:00Z', 100, '2027-01-26', 100],
      ]) {
        await controller.createCustom(context({ name: 'Teste', type, startDate, endDate, totalDays }));
        assert.equal(saved.at(-1).endDate.toUTC().toISODate(), expectedEnd);
        assert.equal(saved.at(-1).totalDays, expectedDays);
      }
    }
    await controller.createCustom(context({ name: '100 dias', type: 'nt-100',
      startDate: '2026-10-18T00:00:00Z', endDate: '2027-01-26T00:00:00Z', totalDays: 100 }));
    assert.equal(saved.at(-1).totalDays, 100);
  } finally {
    Settings.now = previousNow;
  }
});
