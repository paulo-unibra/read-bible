const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');
const source = fs.readFileSync('api/app/controllers/drive_assets_controller.ts', 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
async function download(member) {
  const loaded = { exports: {} };
  const queries = [];
  const file = { id: 'audio-id', name: 'genesis-1.mp3', size: '2048', trashed: false };
  let mediaRequested = false;
  const mockFetch = async (input) => {
    const url = new URL(input);
    if (url.searchParams.get('alt') === 'media') {
      mediaRequested = true;
      return new Response('audio', { headers: { 'Content-Type': 'audio/mpeg' } });
    }
    if (url.pathname.endsWith('/audio-id')) return Response.json(file);
    queries.push(url.searchParams.get('q'));
    return Response.json({ files: queries.length === 1 || member ? [file] : [] });
  };
  new Function('require', 'exports', 'fetch', outputText)((id) => id === '#start/env'
    ? { __esModule: true, default: { get: (name) => name === 'GOOGLE_API_KEY' ? 'test-key' : 'approved-folder' } }
    : require(id), loaded.exports, mockFetch);
  const response = {
    statusCode: 200,
    header() { return this; },
    status(value) { this.statusCode = value; return this; },
    send(body) { return body; },
    notFound(body) { this.statusCode = 404; return body; },
    internalServerError(body) { this.statusCode = 500; return body; },
    async stream(stream) { let text = ''; for await (const chunk of stream) text += chunk; return text; },
  };
  const result = await new loaded.exports.default().downloadAudio({ params: { fileName: file.name }, response });
  return { result, response, queries, mediaRequested };
}
test('downloads public audio without parents metadata after folder validation', async () => {
  const { result, response, queries } = await download(true);
  assert.equal(response.statusCode, 200);
  assert.equal(result, 'audio');
  assert.match(queries[1], /'approved-folder' in parents/);
});
test('rejects files outside the approved folder before requesting media', async () => {
  const { response, mediaRequested } = await download(false);
  assert.equal(response.statusCode, 404);
  assert.equal(mediaRequested, false);
});
