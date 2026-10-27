// Use only an isolated MySQL instance; no project .env is loaded.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const knexFactory = require('../api/node_modules/knex');
const { DateTime } = require('../api/node_modules/luxon');
const socketPath = process.env.CERTIFICATES_TEST_SOCKET;
if (!socketPath || !socketPath.startsWith('/tmp/')) throw new Error('An isolated /tmp MySQL socket is required.');
const connection = { socketPath, user: 'root', password: '' };
function load(file, modules) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'exports', js)(id => modules[id], loaded.exports);
  return loaded.exports;
}
(async () => {
  const admin = knexFactory({ client: 'mysql2', connection });
  const database = 'readbible_certificates_test';
  let db;
  try {
    await admin.raw(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);
    db = knexFactory({ client: 'mysql2', connection: { ...connection, database } });
    for (const file of [
      '1765515065282_create_users_table.ts',
      '1765515065286_create_reading_plans_table.ts',
      '1765515065288_create_reading_progress_table.ts',
      '1793300000000_create_reading_certificates.ts',
    ]) {
      const queries = [];
      class BaseSchema {
        schema = { createTable: (...args) => queries.push(db.schema.createTable(...args)) };
      }
      const Migration = load(`api/database/migrations/${file}`, { '@adonisjs/lucid/schema': { BaseSchema } }).default;
      await new Migration().up();
      for (const query of queries) await query;
    }
    await db('users').insert([
      { id: 1, full_name: 'Leitor de teste', email: 'one@example.invalid', password: 'unused', created_at: new Date() },
      { id: 2, full_name: 'Outro leitor', email: 'two@example.invalid', password: 'unused', created_at: new Date() },
    ]);
    await db('reading_plans').insert({ id: 1, user_id: 1, name: 'Plano anual 2026', type: 'yearly', start_date: new Date(), end_date: new Date(), total_days: 1, chapters_per_day: 3, total_chapters: 3, completed_chapters: 999, created_at: new Date() });
    await db('reading_progress').insert({ reading_plan_id: 1, day: 1, book_name: 'João', start_chapter: 1, end_chapter: 3, is_completed: false, created_at: new Date() });
    const ReadingPlan = { query: () => ({ where: (_column, userId) => ({ preload: async () => {
      const plans = await db('reading_plans').where('user_id', userId);
      return Promise.all(plans.map(async p => ({ id: p.id, name: p.name, type: p.type, totalChapters: p.total_chapters,
        progress: (await db('reading_progress').where('reading_plan_id', p.id)).map(r => ({ bookName: r.book_name, startChapter: r.start_chapter, endChapter: r.end_chapter, isCompleted: r.is_completed, completedAt: r.completed_at ? DateTime.fromJSDate(r.completed_at) : null })) })));
    } }) }) };
    const { getPlanCompletion } = load('api/app/utils/plan_completion.ts', {});
    const Controller = load('api/app/controllers/achievements_controller.ts', {
      '#models/reading_plan': { __esModule: true, default: ReadingPlan },
      '@adonisjs/lucid/services/db': { __esModule: true, default: { from: table => db(table), table: table => db(table) } },
      luxon: { DateTime }, '#utils/plan_completion': { getPlanCompletion },
    }).default;
    const controller = new Controller();
    const context = { auth: { user: { id: 1, fullName: 'Leitor de teste' } }, response: { ok: value => value } };
    assert.equal((await controller.sync(context)).data.length, 0, 'inflated counter must not issue a certificate');
    await db('reading_progress').update({ is_completed: true, completed_at: new Date('2026-10-24T12:00:00Z') });
    const responses = await Promise.all([controller.sync(context), controller.sync(context)]);
    for (const response of responses) {
      assert.equal(response.data.length, 1);
      assert.equal(response.data[0].readerName, 'Leitor de teste');
      assert.equal(response.data[0].totalChapters, 3);
      assert.equal(response.data[0].code, 'BF-2026-1');
      assert.ok(response.data[0].completedAt);
    }
    assert.equal((await db('reading_certificates').count('* as count'))[0].count, 1);
    assert.equal((await controller.sync({ ...context, auth: { user: { id: 2, fullName: 'Outro leitor' } } })).data.length, 0);
    await db('reading_plans').where('id', 1).del();
    assert.equal((await controller.sync(context)).data.length, 1, 'earned certificate must survive plan deletion');
    console.log('MySQL integration passed: actual migrations, eligibility, concurrent issuance, account isolation, persistence after plan deletion.');
  } finally {
    if (db) { await db.destroy(); await admin.raw(`DROP DATABASE ${database}`); }
    await admin.destroy();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
