const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, modules = {}, fetcher) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const result = { exports: {} };
  new Function('require', 'exports', 'fetch', js)(id => modules[id], result.exports, fetcher);
  return result.exports;
}
const { getCertificateNameRemainingDays } = load('utils/certificateNameReminder.ts');
const plan = { id: '1', isActive: true, totalDays: 365, completedDays: 360 };
test('name reminder is available for the final five reading days, including overdue plans', () => {
  for (let remaining = 1; remaining <= 5; remaining++) {
    assert.equal(getCertificateNameRemainingDays({ ...plan, completedDays: 365 - remaining, endDate: '2020-01-01' }, []), remaining);
  }
  assert.equal(getCertificateNameRemainingDays({ ...plan, completedDays: 359 }, []), null);
  assert.equal(getCertificateNameRemainingDays({ ...plan, completedDays: 365 }, []), null);
  assert.equal(getCertificateNameRemainingDays({ ...plan, isCompleted: true }, []), null);
  assert.equal(getCertificateNameRemainingDays({ ...plan, isActive: false }, []), null);
  assert.equal(getCertificateNameRemainingDays(null, []), null);
});
test('a partially loaded schedule is not mistaken for a nearly completed plan', () => {
  const days = [1,2,3,4,5].map(dayNumber => ({ dayNumber, planId: '1', isCompleted: true }));
  assert.equal(getCertificateNameRemainingDays({ ...plan, completedDays: 5 }, days), null);
  assert.equal(getCertificateNameRemainingDays(plan, days), 5);
  assert.equal(getCertificateNameRemainingDays({ ...plan, totalDays: 10, completedDays: 0 }, [...days, ...days]), 5);
});
async function setup(fetcher) {
  const writes = [];
  const storage = { getItem: async key => key === '@auth_token' ? 'test-token' : JSON.stringify({ id: 1, name: 'Nome Anterior', email: 'test@example.invalid' }), setItem: async (...args) => writes.push(args) };
  const { default: auth } = load('services/AuthService.ts', {
    './ReadingVoice': {},
    '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    'expo-constants': { __esModule: true, default: { expoConfig: { extra: { apiUrl: 'https://example.invalid/api' } } } },
  }, fetcher);
  await auth.init();
  return { auth, writes };
}
test('server confirmation precedes updating the name used by the certificate', async () => {
  const { auth, writes } = await setup(async (url, options) => {
    assert.ok(url.endsWith('/auth/profile'));
    assert.equal(options.method, 'PUT');
    assert.deepEqual(JSON.parse(options.body), { name: 'Nome Completo' });
    return Response.json({ success: true, data: { name: 'Nome Completo' } });
  });
  await auth.updateUserName(' Nome Completo ');
  assert.equal(auth.getUser().name, 'Nome Completo');
  assert.equal(writes.length, 1);
});
test('network and server failures do not pretend the certificate name was saved', async () => {
  for (const fetcher of [async () => { throw Error('offline'); }, async () => Response.json({ success: false, message: 'Nome inválido' }, { status: 400 })]) {
    const { auth, writes } = await setup(fetcher);
    await assert.rejects(auth.updateUserName('Nome Novo'));
    assert.equal(auth.getUser().name, 'Nome Anterior');
    assert.equal(writes.length, 0);
  }
});

test('complete schedules use actual pending reading days even if the calendar allows more days', () => {
  const days = [
    { planId:'1', dayNumber:1, isCompleted:true, readings:[{ bookName:'João',startChapter:1,endChapter:2 }] },
    { planId:'1', dayNumber:2, isCompleted:true, readings:[{ bookName:'João',startChapter:3,endChapter:4 }] },
    { planId:'1', dayNumber:3, isCompleted:false, readings:[{ bookName:'João',startChapter:5,endChapter:5 }] },
  ];
  assert.equal(getCertificateNameRemainingDays({ ...plan, completedDays:2, totalChapters:5 }, days), 1);
  assert.equal(getCertificateNameRemainingDays({ ...plan, completedDays:2, totalChapters:6 }, days), null);
  assert.equal(getCertificateNameRemainingDays({ ...plan, completedDays:3, totalChapters:5 }, days.map(d=>({...d,isCompleted:true}))), null);
});
