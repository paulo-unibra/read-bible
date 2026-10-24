// Build locally, then run the emitted maintenance script from the API directory.
// Dry run: node scripts/backfill-existing-tamagoshis.cjs --bundle > /tmp/pets.cjs
// Apply: node /tmp/pets.cjs --apply (with the intended database environment).
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

async function run(pointsCode, catalogCode, apply) {
  const fs = require('node:fs');
  const path = require('node:path');
  const { createHash } = require('node:crypto');
  if (fs.existsSync('.env')) process.loadEnvFile('.env');
  const appRequire = require('node:module').createRequire(path.resolve('package.json'));
  const knex = appRequire('knex')({ client: 'mysql2', connection: {
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  }, pool: { min: 0, max: 2 } });
  const { DateTime } = appRequire('luxon');
  function load(code, dependencies) {
    const module = { exports: {} };
    new Function('require', 'exports', code)(id => {
      if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
      return dependencies[id];
    }, module.exports);
    return module.exports;
  }
  const catalog = load(catalogCode, { 'node:crypto': require('node:crypto') });
  const pointsFor = client => load(pointsCode, {
    '@adonisjs/lucid/services/db': { __esModule: true, default: client },
    '#models/user': { __esModule: true, default: class UnusedUserModel {} },
    '#utils/default_tamagoshi': catalog, luxon: appRequire('luxon'),
  });
  const hash = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  const missing = () => knex.from('users as u').leftJoin('tamagoshi_profiles as p', 'p.user_id', 'u.id')
    .whereNull('p.user_id').orderBy('u.id').select('u.id');
  try {
    const now = DateTime.utc();
    const month = pointsFor(knex).scorePeriod(now).month;
    const before = await knex.from('tamagoshi_profiles').orderBy('user_id').select('*');
    const candidates = await missing();
    const report = { month, existingPreserved: before.length, missing: candidates.length, apply };
    console.log(JSON.stringify(report));
    if (!apply || !candidates.length) return;
    const backupDir = process.env.READBIBLE_BACKUP_DIR || path.resolve('..', 'backups');
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupFile = path.join(backupDir, `tamagoshi-backfill-${Date.now()}.json`);
    const planned = candidates.map(({ id }) => ({ user_id: id, ...catalog.defaultTamagoshi(),
      activated_at: now.startOf('second').toSQL({ includeOffset: false }) }));
    const backup = { month, existingProfileHash: hash(before), planned, committedUserIds: [] };
    const checkpoint = () => fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), { mode: 0o600 });
    checkpoint();
    let points = 0;
    for (let offset = 0; offset < planned.length; offset += 25) {
      const batch = planned.slice(offset, offset + 25);
      const result = await knex.transaction(async trx => {
        const locked = await trx.from('users').whereIn('id', batch.map(p => p.user_id))
          .orderBy('id').forUpdate().select('id');
        const eligible = new Set(locked.map(row => row.id));
        const existing = await trx.from('tamagoshi_profiles').whereIn('user_id', batch.map(p => p.user_id)).select('user_id');
        existing.forEach(row => eligible.delete(row.user_id));
        const service = pointsFor(trx).default;
        const created = [];
        let batchPoints = 0;
        for (const profile of batch) {
          if (!eligible.has(profile.user_id)) continue;
          await trx.table('tamagoshi_profiles').insert(profile);
          await service.backfill(profile.user_id, now);
          const score = await service.summary(profile.user_id, now);
          batchPoints += score.points;
          await trx.table('audit_logs').insert({ user_id: profile.user_id, action: 'tamagoshi.bulk_create',
            entity_type: 'tamagoshi_profile', entity_id: profile.user_id,
            details: JSON.stringify({ reason: 'Generate pets for existing accounts', month,
              points: score.points, job: path.basename(backupFile) }),
            created_at: now.toSQL({ includeOffset: false }) });
          created.push(profile.user_id);
        }
        return { created, points: batchPoints };
      });
      backup.committedUserIds.push(...result.created);
      checkpoint();
      points += result.points;
      console.log(JSON.stringify({ created: backup.committedUserIds.length, total: planned.length }));
    }
    const preserved = before.length ? await knex.from('tamagoshi_profiles')
      .whereIn('user_id', before.map(row => row.user_id)).orderBy('user_id').select('*') : [];
    if (hash(preserved) !== hash(before)) throw new Error('Existing profiles changed concurrently; inspect before proceeding.');
    const remaining = await missing();
    console.log(JSON.stringify({ complete: remaining.length === 0, created: backup.committedUserIds.length,
      existingPreserved: before.length, remaining: remaining.length, monthlyPointsRecovered: points, month }));
    if (remaining.length) throw new Error('Accounts without pets remain; rerun to cover new concurrent registrations.');
  } finally { await knex.destroy(); }
}

if (require.main === module) {
  if (!process.argv.includes('--bundle')) throw new Error('Use --bundle to produce a dry-run maintenance script; --apply is required to mutate data.');
  const root = path.resolve(__dirname, '..');
  const apiRequire = createRequire(path.join(root, 'api/package.json'));
  const ts = apiRequire('typescript');
  const compile = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const code = `(${run.toString()})(${JSON.stringify(compile('api/app/services/tamagoshi_points_service.ts'))},${JSON.stringify(compile('api/app/utils/default_tamagoshi.ts'))},process.argv.includes('--apply')).catch(error=>{console.error(error.code||error.message);process.exitCode=1;});\n`;
  process.stdout.write(code);
}
