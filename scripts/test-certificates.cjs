const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, modules = {}, fetcher) {
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'exports', 'fetch', compiled)(id => id === './CertificateDesign' ? { ...load('utils/certificateTheme.ts'), loadCertificateArtwork: async () => ({ background: '', font: '' }) } : modules[id], loaded.exports, fetcher);
  return loaded.exports;
}
const { getPlanCompletion } = load('api/app/utils/plan_completion.ts');
const reading = (bookName, startChapter, endChapter, extra = {}) => ({ bookName, startChapter, endChapter, isCompleted: true, completedAt: { toISO: () => '2026-10-24T12:00:00.000Z' }, ...extra });
test('only a nonempty fully completed schedule earns a certificate', () => {
  assert.equal(getPlanCompletion(0, []), null);
  assert.equal(getPlanCompletion(3, []), null);
  assert.equal(getPlanCompletion(3, [reading('João', 1, 3, { isCompleted: false })]), null);
  assert.equal(getPlanCompletion(3, [reading('João', 1, 2)]), null);
  assert.equal(getPlanCompletion(3, [reading('João', 1, 3), reading('João', 4, 4, { isCompleted: false })]), null);
  assert.deepEqual(getPlanCompletion(3, [reading('João', 1, 3)]), { completedAt: '2026-10-24T12:00:00.000Z', chapters: 3 });
});
test('overlapping chapters and duplicated records do not fabricate completion', () => {
  assert.equal(getPlanCompletion(5, [reading('João', 1, 3), reading('João', 1, 3)]), null);
  assert.equal(getPlanCompletion(5, [reading('João', 1, 3), reading('João', 3, 4)]), null);
  assert.ok(getPlanCompletion(5, [reading('João', 1, 3), reading('Mateus', 1, 2)]));
});
test('invalid readings and absent completion dates do not earn awards', () => {
  assert.equal(getPlanCompletion(1, [reading('João', 0, 1)]), null);
  assert.equal(getPlanCompletion(1, [reading('João', 1, 200)]), null);
  assert.equal(getPlanCompletion(1, [reading('João', 1, 1, { completedAt: null })]), null);
});
test('certificate date is the final reading date', () => {
  const value = getPlanCompletion(2, [reading('João', 1, 1), reading('João', 2, 2, { completedAt: { toISO: () => '2026-10-25T09:00:00Z' } })]);
  assert.equal(value.completedAt, '2026-10-25T09:00:00Z');
});
function api(fetcher) {
  const session = { id: 1, token: 'test-token' };
  const auth = { getToken: () => session.token, getUser: () => session.id ? { id: session.id } : null };
  const loaded = load('services/AchievementService.ts', { './AuthService': { __esModule: true, default: auth, API_URL: 'https://example.invalid/api' } }, (...args) => fetcher(session, ...args));
  return { ...loaded, session };
}
test('certificate request uses authenticated session and POST', async () => {
  const service = api(async (_, url, options) => {
    assert.equal(url, 'https://example.invalid/api/achievements/sync');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return Response.json({ success: true, data: [] });
  });
  assert.deepEqual(await service.getMyCertificates(), []);
});
test('a delayed response from a different account is rejected', async () => {
  const service = api(async session => {
    session.id = 2;
    return Response.json({ success: true, data: [{ readerName: 'Other reader' }] });
  });
  await assert.rejects(service.getMyCertificates(), /sessão mudou/);
});
test('signed-out users make no request; unavailable API is an error, not an empty collection', async () => {
  const signedOut = api(() => { throw Error('must not fetch'); });
  signedOut.session.id = null;
  assert.deepEqual(await signedOut.getMyCertificates(), []);
  const unavailable = api(() => Response.json({}, { status: 500 }));
  await assert.rejects(unavailable.getMyCertificates(), /Tente novamente/);
});
test('PDF escapes user content and renders the actual plan and date', () => {
  const achievements = api(() => {});
  const { getCertificateHtml } = load('services/CertificateExportService.ts', { './AchievementService': achievements, 'react-native': { Platform: { OS: 'android' } } });
  const html = getCertificateHtml({ readerName: '<script>alert(1)</script>', planName: 'Plano & leitura', totalChapters: 1189, completedAt: '2026-10-24T12:00:00Z', code: 'BF-2026-1' });
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Plano &amp; leitura'));
  assert.ok(html.includes('24 de outubro de 2026'));
  assert.ok(html.includes('BF-2026-1'));
});

test('awards are scoped to the authenticated reader, issued once and retained after removing a plan', async () => {
  const records = [];
  let plans = [
    { id: 11, userId: 1, totalChapters: 2, name: 'Plano 2026', type: 'yearly', progress: [reading('João', 1, 2)] },
    { id: 12, userId: 2, totalChapters: 2, name: 'Outro leitor', type: 'yearly', progress: [reading('João', 1, 2)] },
    { id: 13, userId: 1, totalChapters: 2, name: 'Incompleto', type: 'yearly', progress: [reading('João', 1, 1)] },
  ];
  const db = {
    from() {
      let userId;
      const query = {
        where(_column, id) { userId = id; return query; },
        select() { return Promise.resolve(records.filter(item => item.user_id === userId)); },
        orderBy() { return query; },
        then(resolve, reject) { return Promise.resolve(records.filter(item => item.user_id === userId)).then(resolve, reject); },
      };
      return query;
    },
    table() { return { async insert(item) {
      if (records.some(row => row.reading_plan_id === item.reading_plan_id)) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
      records.push({ ...item, id: records.length + 1 });
    } }; },
  };
  const { default: Controller } = load('api/app/controllers/achievements_controller.ts', {
    '#models/reading_plan': { __esModule: true, default: { query: () => ({ where: (_key, userId) => ({ preload: async () => plans.filter(item => item.userId === userId) }) }) } },
    '@adonisjs/lucid/services/db': { __esModule: true, default: db },
    luxon: require('../api/node_modules/luxon'),
    '#utils/plan_completion': { getPlanCompletion },
  });
  const context = { auth: { user: { id: 1, fullName: 'Leitor Um' } }, response: { ok: value => value } };
  const controller = new Controller();
  const [first, parallel] = await Promise.all([controller.sync(context), controller.sync(context)]);
  assert.equal(records.length, 1);
  assert.equal(first.data.length, 1);
  assert.equal(parallel.data.length, 1);
  assert.equal(first.data[0].readerName, 'Leitor Um');
  assert.equal(first.data[0].code, 'BF-2026-11');
  plans = [];
  assert.equal((await controller.sync(context)).data.length, 1);
  const other = await controller.sync({ ...context, auth: { user: { id: 2, fullName: 'Outro leitor' } } });
  assert.deepEqual(other.data, []);
});


test('web prints the certificate itself without expecting a native PDF URI', async () => {
  const achievements = api(() => {});
  let loadHandler;
  let written = '';
  let printed = 0;
  const preview = {
    document: { open() {}, write(html) { written = html; }, close() { loadHandler(); } },
    addEventListener(name, handler) { assert.equal(name, 'load'); loadHandler = handler; },
    focus() {}, print() { printed++; },
  };
  const previous = global.window;
  global.window = { open: () => preview };
  try {
    const { shareCertificate } = load('services/CertificateExportService.ts', {
      './AchievementService': achievements, 'react-native': { Platform: { OS: 'web' } },
    });
    await shareCertificate({ readerName: 'Paulo', planName: 'Plano 2027', totalChapters: 1189, completedAt: '2026-10-24T12:00:00Z', code: 'BF-2026-382' });
    assert.equal(printed, 1);
    assert.ok(written.includes('Paulo'));
    assert.ok(written.includes('Certificado de conclusão'));
    global.window.open = () => null;
    await assert.rejects(shareCertificate({ readerName: 'Paulo', planName: 'Plano', totalChapters: 1189, completedAt: '2026-10-24T12:00:00Z', code: 'BF-2026-382' }), /Permita abrir novas janelas/);
  } finally { global.window = previous; }
});

test('native shares the generated PDF and uses print fallback when sharing is unavailable', async () => {
  const achievements = api(() => {});
  const calls = [];
  let available = true;
  let uri = 'file:///cache/certificate.pdf';
  const { shareCertificate } = load('services/CertificateExportService.ts', {
    './AchievementService': achievements, 'react-native': { Platform: { OS: 'android' } },
    'expo-print': { printToFileAsync: async options => { calls.push(['generate', options]); return { uri, base64: 'JVBERi0xLjQ=' }; }, printAsync: async options => calls.push(['print', options]) },
    'expo-sharing': { isAvailableAsync: async () => available, shareAsync: async (...args) => calls.push(['share', ...args]) },
    'expo-file-system': { Paths: { cache: 'file:///project-cache/' }, File: class {
      constructor(directory, name) { this.uri = directory + name; this.exists = false; this.size = 0; }
      create() { this.exists = true; }
      async write(data, options) {
        assert.equal(data, 'JVBERi0xLjQ=');
        assert.equal(options.encoding, 'base64');
        await new Promise(resolve => setImmediate(resolve));
        this.size = 8;
      }
    } },
  });
  const certificate = { readerName: 'Paulo', planName: 'Plano 2027', totalChapters: 1189, completedAt: '2026-10-24T12:00:00Z', code: 'BF-2026-382' };
  await shareCertificate(certificate);
  assert.equal(calls[0][0], 'generate');
  assert.equal(calls[1][0], 'share');
  assert.ok(calls[1][1].startsWith('file:///project-cache/certificado-'));
  assert.notEqual(calls[1][1], uri, 'must never share the host cache URI returned by expo-print');
  assert.equal(calls[0][1].base64, true);
  assert.equal(calls[1][2].mimeType, 'application/pdf');
  uri = undefined;
  await assert.rejects(shareCertificate(certificate), /não retornou um arquivo/);
  calls.length = 0;
  available = false;
  await shareCertificate(certificate);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'print');
});

test('photo sharing captures only the certificate and waits for the scoped full-resolution PNG to finish writing', async () => {
  const achievements = api(() => {});
  const target = { current: {} };
  let saved = false;
  let shared = false;
  const { shareCertificateImage } = load('services/CertificateExportService.ts', {
    './AchievementService': achievements, 'react-native': { Platform: { OS: 'android' } },
    'react-native-view-shot': { captureRef: async (ref, options) => {
      assert.equal(ref, target);
      assert.equal(options.format, 'png');
      assert.equal(options.result, 'base64');
      assert.equal(options.width, 2526);
      assert.equal(options.height, 1785);
      assert.equal(options.width / options.height, 842 / 595);
      return 'jpeg-data';
    } },
    'expo-file-system': { Paths: { cache: 'file:///project-cache/' }, File: class {
      constructor(directory, name) { this.uri = directory + name; this.exists = true; this.size = 0; }
      create() {}
      async write(data, options) {
        assert.equal(data, 'jpeg-data'); assert.equal(options.encoding, 'base64');
        await new Promise(resolve => setImmediate(resolve));
        this.size = 100; saved = true;
      }
    } },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async (uri, options) => {
      assert.ok(saved); assert.ok(uri.startsWith('file:///project-cache/certificado-'));
      assert.ok(uri.endsWith('.png')); assert.equal(options.mimeType, 'image/png'); shared = true;
    } },
  });
  await shareCertificateImage({ id: 2 }, target);
  assert.ok(shared);
});

test('native PDF prints the rendered certificate as a single image instead of laying out text again', async () => {
  const achievements = api(() => {});
  const target = { current: {} };
  let pdfHtml;
  let shared = false;
  const { shareCertificate, getCertificateImageHtml } = load('services/CertificateExportService.ts', {
    './AchievementService': achievements, 'react-native': { Platform: { OS: 'android' } },
    'react-native-view-shot': { captureRef: async (ref, options) => {
      assert.equal(ref, target); assert.equal(options.width, 2526); assert.equal(options.height, 1785);
      return 'aW1hZ2U=';
    } },
    'expo-print': { printToFileAsync: async options => {
      pdfHtml = options.html; return { uri: 'file:///host/pdf', base64: 'cGRm' };
    } },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => { shared = true; } },
    'expo-file-system': { Paths: { cache: 'file:///project/' }, File: class {
      constructor() { this.uri = 'file:///project/cert.pdf'; this.size = 0; this.exists = true; }
      create() {}
      async write() { await new Promise(resolve => setImmediate(resolve)); this.size = 3; }
    } },
  });
  await shareCertificate({ id: 2, readerName: 'Paulo' }, target);
  assert.ok(shared);
  assert.ok(pdfHtml.includes('data:image/jpeg;base64,aW1hZ2U='));
  assert.ok(pdfHtml.includes('A4 landscape'));
  assert.ok(!pdfHtml.includes('@font-face'));
  assert.ok(!pdfHtml.includes('class="title"'));
  assert.throws(() => getCertificateImageHtml('<script>'), /inválida/);
});

test('saving to the gallery uses PNG and does not request read access on modern Android', async () => {
  let created;
  const { saveCertificateImage } = load('services/CertificateExportService.ts', {
    'react-native': { Platform: { OS: 'android', Version: 36 } },
    'expo-media-library': { requestPermissionsAsync: () => { throw Error('unnecessary permission'); }, Asset: { create: async uri => { created = uri; } } },
    'react-native-view-shot': { captureRef: async () => 'aW1hZ2U=' },
    'expo-file-system': { Paths: { cache: 'file:///cache/' }, File: class {
      constructor(directory, name) { this.uri = directory + name; this.exists = true; this.size = 0; }
      create() {}
      async write() { await new Promise(resolve => setImmediate(resolve)); this.size = 5; }
    } },
  });
  await saveCertificateImage({ id: 2 }, { current: {} });
  assert.ok(created.startsWith('file:///cache/certificado-2-'));
  assert.ok(created.endsWith('.png'));
});

test('denied write permission prevents gallery capture on iOS', async () => {
  const { saveCertificateImage } = load('services/CertificateExportService.ts', {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-media-library': { requestPermissionsAsync: async writeOnly => {
      assert.equal(writeOnly, true); return { granted: false };
    } },
  });
  await assert.rejects(saveCertificateImage({ id: 2 }, {}), /Permita salvar fotos/);
});


test('annual themes preserve 2026 and rotate deterministically for future completion years', () => {
  const { getCertificateTheme, getCertificateYear } = load('utils/certificateTheme.ts');
  for (const [year, expected] of [[2025,'classic'],[2026,'classic'],[2027,'blue'],[2028,'burgundy'],[2029,'purple'],[2030,'classic'],[2031,'blue']]) {
    assert.equal(getCertificateTheme(`${year}-07-01T12:00:00Z`).id, expected);
  }
  assert.equal(getCertificateYear('2027-01-01T01:00:00Z'), '2026');
  assert.equal(getCertificateTheme('2027-01-01T01:00:00Z').id, 'classic');
  assert.equal(getCertificateTheme('2027-01-01T04:00:00Z').id, 'blue');
});
test('HTML uses the completion year palette and does not confuse it with the plan name', () => {
  const achievements = api(() => {});
  const { getCertificateHtml } = load('services/CertificateExportService.ts', { './AchievementService': achievements, 'react-native': { Platform: { OS: 'android' } } });
  const base = { readerName: 'Paulo', planName: 'Plano 2030', totalChapters: 1189, code:'BF-1' };
  const classic = getCertificateHtml({ ...base, completedAt: '2026-10-24T12:00:00Z' });
  const blue = getCertificateHtml({ ...base, completedAt: '2027-10-24T12:00:00Z' });
  assert.ok(classic.includes('#173520'));
  assert.ok(blue.includes('#1b3554'));
  assert.ok(blue.includes('#4d6078'));
});

test('artwork cache keeps each annual background separate', async () => {
  const themes = load('utils/certificateTheme.ts');
  const downloads = [];
  const { loadCertificateArtwork } = load('services/CertificateDesign.ts', {
    '../utils/certificateTheme': themes,
    '../assets/certificates/classic-background.png': 'classic',
    '../assets/certificates/blue-background.png': 'blue',
    '../assets/certificates/burgundy-background.png': 'burgundy',
    '../assets/certificates/purple-background.png': 'purple',
    '../assets/fonts/CertificateSerif.ttf': 'font',
    'react-native': { Platform: { OS: 'android' } },
    'expo-asset': { Asset: { fromModule: id => ({ localUri: id, downloadAsync: async () => { downloads.push(id); } }) } },
    'expo-file-system': { File: class { constructor(uri) { this.uri = uri; } async base64() { return this.uri; } } },
  });
  const classic = await loadCertificateArtwork('2026-10-24T12:00:00Z');
  const blue = await loadCertificateArtwork('2027-10-24T12:00:00Z');
  assert.equal(classic.background, 'data:image/png;base64,classic');
  assert.equal(blue.background, 'data:image/png;base64,blue');
  assert.strictEqual(await loadCertificateArtwork('2026-11-24T12:00:00Z'), classic);
  assert.equal(downloads.filter(id => id === 'classic').length, 1);
});
