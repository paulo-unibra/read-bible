const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('services/ReferralService.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
function setup(fetcher) {
  const session = { userId: 1, token: 'test-session' };
  const awarded = [];
  const modules = {
    './AuthService': { __esModule: true, API_URL: 'https://example.invalid/api', default: { getUser: () => ({ id: session.userId }), getToken: () => session.token } },
    './TamagoshiService': { __esModule: true, default: { applyInviteRewards: async (...args) => awarded.push(args) } },
  };
  const loaded = { exports: {} };
  new Function('require', 'exports', 'fetch', compiled)(id => modules[id], loaded.exports, (...args) => fetcher(session, ...args));
  return { api: loaded.exports.default, session, awarded };
}
const summary = { code: 'A1B2C3D4E5F6', totalHealthPoints: 5, rewardPerInvite: 5 };
test('aplica somente o total de convites retornado pelo servidor para a conta autenticada', async () => {
  const { api, awarded } = setup(async () => Response.json({ success: true, data: summary }));
  assert.deepEqual(await api.getMine(), summary);
  assert.deepEqual(awarded, [[1, 5]]);
});
test('resposta atrasada após mudança de sessão não concede pontos', async () => {
  const { api, awarded } = setup(async session => {
    session.userId = 2; session.token = 'another-session';
    return Response.json({ success: true, data: summary });
  });
  await assert.rejects(api.getMine(), /sessão mudou/);
  assert.equal(awarded.length, 0);
});
test('falhas da API e totais inválidos não concedem pontos', async () => {
  for (const response of [
    () => Response.json({ success: false }, { status: 401 }),
    () => Response.json({ success: true, data: { ...summary, totalHealthPoints: -5 } }),
  ]) {
    const { api, awarded } = setup(async () => response());
    await assert.rejects(api.getMine());
    assert.equal(awarded.length, 0);
  }
});
