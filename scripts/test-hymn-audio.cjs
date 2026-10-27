const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadService(name, mocks) {
  const filename = path.resolve(__dirname, '../services', `${name}.ts`);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)((id) => {
    assert.ok(id in mocks, `Unexpected dependency: ${id}`);
    return mocks[id];
  }, module, module.exports);
  return module.exports.default;
}

test('hymn mixer converts milliseconds to seconds and preserves pitch and volume', async () => {
  const calls = [];
  const player = {
    isLoaded: true, playing: true, currentTime: 1.25, duration: 90,
    play() { calls.push('play'); },
    pause() { calls.push('pause'); },
    async seekTo(seconds) { calls.push(['seek', seconds]); },
    setPlaybackRate(rate) { calls.push(['rate', rate]); },
    remove() { calls.push('remove'); },
  };
  const Sound = loadService('HymnSound', {
    'expo-audio': { createAudioPlayer: () => player },
  });
  const { sound } = await Sound.createAsync({ uri: 'file:///hymn.mp3' }, {
    volume: 0.4, shouldPlay: false, progressUpdateIntervalMillis: 100,
  });
  assert.equal(player.volume, 0.4);
  assert.deepEqual(await sound.getStatusAsync(), {
    isLoaded: true, isPlaying: true, positionMillis: 1250, durationMillis: 90000,
  });
  await sound.setPositionAsync(3500);
  await sound.setRateAsync(0.75, true);
  assert.equal(player.shouldCorrectPitch, true);
  await sound.setVolumeAsync(0);
  assert.equal(player.volume, 0);
  await sound.playAsync();
  await sound.pauseAsync();
  await sound.stopAsync();
  await sound.unloadAsync();
  assert.deepEqual(calls, [['seek', 3.5], ['rate', 0.75], 'play', 'pause', 'pause', ['seek', 0], 'remove']);
});

test('failed hymn loading releases the native player so the service can try its fallback', async () => {
  let released = false;
  const Sound = loadService('HymnSound', {
    'expo-audio': { createAudioPlayer: () => ({
      isLoaded: false, currentStatus: { error: 'Network failure' },
      remove() { released = true; },
    }) },
  });
  await assert.rejects(Sound.createAsync({ uri: 'https://example.com/hymn.mp3' }, {
    volume: 1, shouldPlay: false, progressUpdateIntervalMillis: 100,
  }), /Network failure/);
  assert.equal(released, true);
});

function recordingService({ granted = true, prepareError = false } = {}) {
  const calls = [];
  const recorder = {
    uri: 'file:///cache/recording.m4a',
    async prepareToRecordAsync() { if (prepareError) throw new Error('Microphone busy'); },
    record() { calls.push('record'); },
    getStatus() { return { durationMillis: 1234 }; },
    async stop() { calls.push('stop'); },
    release() { calls.push('release'); },
  };
  const service = loadService('HymnRecordingService', {
    'expo-audio': {
      AudioModule: { AudioRecorder: class { constructor() { return recorder; } } },
      RecordingPresets: { HIGH_QUALITY: {} },
      requestRecordingPermissionsAsync: async () => ({ granted }),
    },
    'expo-file-system/legacy': {
      documentDirectory: 'file:///documents/',
      getInfoAsync: async () => ({ exists: true, size: 500 }),
      async moveAsync(args) { calls.push(['move', args]); },
    },
    'expo-sharing': {},
  });
  return { service, recorder, calls };
}

test('recording keeps duration and sync offset when saved with expo-audio', async () => {
  const { service, recorder, calls } = recordingService();
  assert.equal(await service.startRecording(), recorder);
  const saved = await service.stopAndSaveRecording(recorder, 42, -150);
  assert.equal(saved.durationMs, 1234);
  assert.equal(saved.timingOffsetMs, -150);
  assert.match(saved.fileName, /^hino-42-gravacao-\d+-d1234-o-150\.m4a$/);
  assert.deepEqual(calls.slice(0, 3), ['record', 'stop', 'release']);
  assert.equal(calls[3][1].from, recorder.uri);
  assert.equal(calls[3][1].to, saved.uri);
});

test('recording handles permission denial and releases the recorder on preparation errors', async () => {
  const denied = recordingService({ granted: false });
  await assert.rejects(denied.service.startRecording(), /Permissão/);
  assert.deepEqual(denied.calls, []);
  const failed = recordingService({ prepareError: true });
  await assert.rejects(failed.service.startRecording(), /Microphone busy/);
  assert.deepEqual(failed.calls, ['release']);
});
