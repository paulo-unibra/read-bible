const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../services/AudioService.ts');
const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
  fileName: filename,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
});
const script = new vm.Script(Module.wrap(outputText), { filename });

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function until(predicate, message) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  assert.fail(message);
}

function setup(t, { confirmPlay = true, playError = null } = {}) {
  const calls = [];
  const players = [];
  const timers = new Map();
  let appStateHandler;
  let now = 0;
  let nextTimer = 0;

  function createAudioPlayer(source, options) {
    calls.push(['createAudioPlayer', source, options]);
    let status = {
      isLoaded: true,
      playing: false,
      currentTime: 0,
      duration: 120,
      didJustFinish: false,
      isBuffering: false,
    };
    const listeners = new Set();
    const player = {
      listeners,
      playError,
      confirmPlay,
      get currentStatus() { return { ...status }; },
      get playing() { return status.playing; },
      setStatus(update) { status = { ...status, ...update }; },
      dispatch(event) {
        for (const listener of [...listeners]) listener(event);
      },
      emit(update) {
        player.setStatus(update);
        player.dispatch(player.currentStatus);
      },
      play() {
        calls.push(['play']);
        if (player.playError) throw player.playError;
        if (player.confirmPlay) {
          queueMicrotask(() => player.emit({ playing: true, didJustFinish: false }));
        }
      },
      pause() {
        calls.push(['pause']);
        player.emit({ playing: false });
      },
      replace(nextSource) {
        calls.push(['replace', nextSource]);
        player.setStatus({ currentTime: 0, playing: false, didJustFinish: false });
      },
      setActiveForLockScreen(...args) { calls.push(['setActiveForLockScreen', ...args]); },
      updateLockScreenMetadata(metadata) { calls.push(['updateLockScreenMetadata', metadata]); },
      clearLockScreenControls() { calls.push(['clearLockScreenControls']); },
      remove() { calls.push(['remove']); },
      addListener(event, listener) {
        assert.equal(event, 'playbackStatusUpdate');
        listeners.add(listener);
        return { remove() { listeners.delete(listener); } };
      },
      async seekTo(seconds) {
        calls.push(['seekTo', seconds]);
        player.emit({ currentTime: seconds, didJustFinish: false });
      },
    };
    players.push(player);
    return player;
  }

  const mocks = {
    'expo-audio': {
      createAudioPlayer,
      async setAudioModeAsync(options) { calls.push(['setAudioModeAsync', options]); },
      async setIsAudioActiveAsync(active) { calls.push(['setIsAudioActiveAsync', active]); },
    },
    'expo-file-system/legacy': {
      documentDirectory: 'file:///test/',
      async getInfoAsync() { return { exists: true, size: 4096 }; },
      async makeDirectoryAsync() {},
      createDownloadResumable() { throw new Error('Unexpected file download'); },
    },
    'react-native': {
      AppState: {
        addEventListener(event, handler) {
          assert.equal(event, 'change');
          appStateHandler = handler;
          return { remove() {} };
        },
      },
    },
    './BibleBrainService': {
      async getAudioChapterUrl() { return { url: 'https://audio.invalid/chapter.mp3' }; },
      async getAudioTimestamps() { return []; },
    },
  };
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    process: { env: {} },
    Error,
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  });
  const loadedModule = { exports: {} };
  script.runInContext(context)(loadedModule.exports, (id) => {
    assert.ok(Object.hasOwn(mocks, id), `Unexpected module: ${id}`);
    return mocks[id];
  }, loadedModule, filename, path.dirname(filename));
  const service = loadedModule.exports.default;
  const downloadHelpers = {
    getOrDownloadAudioLocalPath: service.getOrDownloadAudioLocalPath,
    getBibleBrainAudioLocalPath: service.getBibleBrainAudioLocalPath,
  };
  service.getOrDownloadAudioLocalPath = async (name) => `file:///test/${name}`;
  service.getBibleBrainAudioLocalPath = async (name) => `file:///test/biblebrain/${name}`;
  service.prefetch = async () => true;

  t.after(async () => {
    await service.stop();
    assert.equal(timers.size, 0, 'Playback timers must be cleared');
    for (const player of players) {
      assert.equal(player.listeners.size, 0, 'Native subscriptions must be removed');
    }
  });

  return {
    service, calls, players, timers, downloadHelpers,
    fileSystem: mocks['expo-file-system/legacy'],
    async appState(state) {
      assert.equal(typeof appStateHandler, 'function');
      appStateHandler(state);
      await Promise.resolve();
    },
    advance(milliseconds) {
      now += milliseconds;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now && timers.delete(id)) timer.callback();
      }
    },
  };
}

function assertStopped(service) {
  const state = service.getState();
  for (const key of ['sound', 'currentBookId', 'currentChapter']) {
    assert.equal(state[key], null, `${key} must be cleared`);
  }
  assert.equal(state.isPlaying, false);
  assert.equal(state.isLoading, false);
  assert.equal(state.currentTime, 0);
  assert.equal(state.duration, 0);
  assert.equal(state.downloadProgress, 0);
}

test('first activation configures background audio and native lock-screen controls before play', async (t) => {
  const { service, calls, players, timers } = setup(t, { confirmPlay: false });
  let resolved = false;
  const loading = service.loadAndPlay(1, 1, { bookName: 'Genesis' });
  loading.then(() => { resolved = true; }, () => {});
  await until(() => calls.some(([name]) => name === 'play'), 'Native play was not requested');

  const names = calls.map(([name]) => name);
  assert.ok(names.indexOf('setIsAudioActiveAsync') >= 0);
  assert.ok(names.indexOf('setIsAudioActiveAsync') < names.indexOf('createAudioPlayer'));
  assert.equal(calls.find(([name]) => name === 'setIsAudioActiveAsync')[1], true);
  assert.ok(names.indexOf('setAudioModeAsync') < names.indexOf('createAudioPlayer'));
  assert.ok(names.indexOf('setActiveForLockScreen') > names.indexOf('createAudioPlayer'));
  assert.ok(names.indexOf('setActiveForLockScreen') < names.indexOf('play'));
  const mode = calls.find(([name]) => name === 'setAudioModeAsync')[1];
  assert.equal(mode.shouldPlayInBackground, true);
  assert.equal(mode.playsInSilentMode, true);
  const activation = calls.find(([name]) => name === 'setActiveForLockScreen');
  assert.equal(activation[1], true);
  assert.equal(activation[2].title, 'Genesis 1');
  assert.ok(activation[2].artist);
  assert.equal(activation[3].showSeekBackward, true);
  assert.equal(activation[3].showSeekForward, true);
  assert.equal(calls.find(([name]) => name === 'createAudioPlayer')[2].keepAudioSessionActive, true);
  assert.equal(resolved, false, 'loadAndPlay must wait for native playback confirmation');
  assert.equal(service.getState().isPlaying, false);
  assert.equal(service.getState().isLoading, true);

  players[0].emit({ playing: true });
  await loading;
  assert.equal(service.getState().sound, players[0]);
  assert.equal(service.getState().isPlaying, true);
  assert.equal(service.getState().isLoading, false);
  assert.equal(timers.size, 0);
});

test('chapter changes replace the same native player without clearing its media session', async (t) => {
  const { service, calls, players } = setup(t);
  await service.loadAndPlay(1, 1, { bookName: 'Genesis' });
  const player = players[0];
  const staleListeners = [...player.listeners];
  let ended = 0;
  service.onEnded(() => { ended++; });
  const boundary = calls.length;
  await service.loadAndPlay(1, 2, { bookName: 'Genesis' });
  const chapterCalls = calls.slice(boundary);
  assert.equal(players.length, 1);
  assert.equal(service.getState().sound, player);
  assert.equal(service.getState().currentChapter, 2);
  assert.equal(service.getState().isPlaying, true);
  assert.equal(chapterCalls.filter(([name]) => name === 'replace').length, 1);
  assert.equal(chapterCalls.find(([name]) => name === 'replace')[1].uri, 'file:///test/genesis-2.mp3');
  assert.equal(chapterCalls.find(([name]) => name === 'updateLockScreenMetadata')[1].title, 'Genesis 2');
  assert.equal(chapterCalls.some(([name]) => ['remove', 'clearLockScreenControls'].includes(name)), false);
  assert.equal(chapterCalls.some(([name, active]) => name === 'setIsAudioActiveAsync' && active === false), false);
  assert.equal(calls.filter(([name]) => name === 'setActiveForLockScreen').length, 1);
  assert.ok(chapterCalls.findIndex(([name]) => name === 'replace') < chapterCalls.findIndex(([name]) => name === 'play'));
  for (const listener of staleListeners) {
    listener({ ...player.currentStatus, didJustFinish: true, playing: false });
  }
  assert.equal(ended, 0, 'Queued status from the previous source must be ignored');
  assert.equal(service.getState().isPlaying, true);
});

test('queued old ended and playing events delivered to new listeners cannot end or confirm the new source', async (t) => {
  const { service, calls, players, timers } = setup(t);
  let ended = 0;
  service.onEnded(() => { ended++; });
  await service.loadAndPlay(1, 1);
  const player = players[0];
  const oldEnded = { ...player.currentStatus, currentTime: 120, playing: false, didJustFinish: true };
  const oldPlaying = { ...player.currentStatus, currentTime: 110, playing: true };
  const oldListeners = [...player.listeners];
  player.confirmPlay = false;
  let resolved = false;
  const loading = service.loadAndPlay(1, 2);
  loading.then(() => { resolved = true; }, () => {});
  await until(() => calls.filter(([name]) => name === 'play').length === 2, 'New source did not request playback');
  assert.ok(oldListeners.every((listener) => !player.listeners.has(listener)));
  assert.ok(player.listeners.size >= 2, 'Deliver to the new status listener and playback waiter');
  const nativeStatus = player.currentStatus;
  assert.equal(nativeStatus.playing, false);
  assert.equal(nativeStatus.currentTime, 0);

  player.dispatch(oldEnded);
  assert.equal(ended, 0, 'Old end payload must not end the new chapter');
  player.dispatch(oldPlaying);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(player.currentStatus, nativeStatus, 'Dispatch must not mutate live native status');
  assert.equal(service.getState().currentTime, 0);
  assert.equal(service.getState().isPlaying, false);
  assert.equal(service.getState().isLoading, true);
  assert.equal(resolved, false, 'Old playing payload must not resolve the playback waiter');
  assert.equal(timers.size, 1, 'Waiter must still require native playback confirmation');

  player.setStatus({ playing: true, currentTime: 7, duration: 90 });
  player.dispatch(oldEnded);
  await loading;
  assert.equal(ended, 0);
  assert.equal(service.getState().currentChapter, 2);
  assert.equal(service.getState().currentTime, 7000);
  assert.equal(service.getState().duration, 90000);
  assert.equal(service.getState().isPlaying, true);
  assert.equal(service.getState().isLoading, false);
  assert.equal(timers.size, 0, 'Live playing must confirm playback even with an old paused payload');
});

test('native seconds become milliseconds in state, notifications and seeking', async (t) => {
  const { service, players, calls } = setup(t);
  const snapshots = [];
  service.addListener((state) => snapshots.push(state));
  await service.loadAndPlay(1, 1);
  players[0].emit({ currentTime: 12.345, duration: 123.75, playing: true });
  assert.equal(service.getState().currentTime, 12345);
  assert.equal(service.getState().duration, 123750);
  assert.equal(snapshots.at(-1).currentTime, 12345);
  assert.equal(snapshots.at(-1).duration, 123750);
  await service.seekTo(42750);
  assert.equal(calls.find(([name]) => name === 'seekTo')[1], 42.75);
  assert.equal(service.getState().currentTime, 42750);
});

test('end callback fires once across repeated events and foreground reconciliation, then resets for a new chapter', async (t) => {
  const { service, players, appState, advance } = setup(t);
  let ended = 0;
  service.onEnded(() => { ended++; });
  await service.loadAndPlay(1, 1);
  const finished = { currentTime: 120, duration: 120, playing: false, didJustFinish: true };
  players[0].emit(finished);
  players[0].emit(finished);
  advance(60000);
  players[0].emit(finished);
  await appState('active');
  await appState('active');
  assert.equal(ended, 1);
  assert.equal(service.getState().isPlaying, false);
  await service.loadAndPlay(1, 2);
  players[0].emit(finished);
  players[0].emit(finished);
  await appState('active');
  assert.equal(ended, 2, 'Each chapter must have its own end guard');
});

test('foreground reconciliation detects a native end missed while backgrounded exactly once', async (t) => {
  const { service, players, appState } = setup(t);
  let ended = 0;
  service.onEnded(() => { ended++; });
  await service.loadAndPlay(1, 1);
  await appState('background');
  players[0].setStatus({ currentTime: 120, playing: false, didJustFinish: true });
  assert.equal(ended, 0);
  await appState('active');
  assert.equal(ended, 1);
  await appState('active');
  players[0].emit({ didJustFinish: true });
  assert.equal(ended, 1);
});

test('iOS event-only end at the live duration fires once and replay seeks to zero without a live end flag', async (t) => {
  const { service, players, calls, appState } = setup(t);
  let ended = 0;
  service.onEnded(() => { ended++; });
  await service.loadAndPlay(1, 1);
  const player = players[0];
  for (let playback = 1; playback <= 2; playback++) {
    player.setStatus({ playing: false, currentTime: 120, duration: 120, didJustFinish: false });
    const endEvent = { ...player.currentStatus, didJustFinish: true };
    player.dispatch(endEvent);
    player.dispatch(endEvent);
    await appState('active');
    assert.equal(ended, playback);
    assert.equal(service.getState().isPlaying, false);
    assert.equal(player.currentStatus.didJustFinish, false, 'Only the iOS event carries the end flag');

    const boundary = calls.length;
    await service.play();
    const replayCalls = calls.slice(boundary);
    assert.equal(replayCalls.filter(([name]) => name === 'seekTo').length, 1);
    assert.equal(replayCalls.find(([name]) => name === 'seekTo')[1], 0);
    assert.ok(replayCalls.findIndex(([name]) => name === 'seekTo') < replayCalls.findIndex(([name]) => name === 'play'));
    assert.equal(player.currentStatus.currentTime, 0);
    assert.equal(service.getState().isPlaying, true);
  }
});

test('pausing near or at the duration never advances without a native end signal', async (t) => {
  const { service, players, appState } = setup(t);
  let ended = 0;
  service.onEnded(() => { ended++; });
  await service.loadAndPlay(1, 1);
  players[0].emit({ currentTime: 119.9, duration: 120, playing: true });
  await service.pause();
  players[0].dispatch({ ...players[0].currentStatus, currentTime: 120, didJustFinish: true });
  assert.equal(ended, 0, 'An event-only end flag before the live duration must be ignored');
  await appState('active');
  players[0].emit({ currentTime: 120, playing: false, didJustFinish: false });
  await appState('active');
  assert.equal(ended, 0);
  assert.equal(service.getState().isPlaying, false);
  assert.equal(service.getState().currentChapter, 1);
});

test('pause and resume, including same-chapter toggles, retain the native source', async (t) => {
  const { service, players, calls } = setup(t);
  await service.loadAndPlay(1, 1);
  players[0].emit({ currentTime: 30 });
  await service.pause();
  assert.equal(players[0].playing, false);
  assert.equal(service.getState().isPlaying, false);
  assert.equal(service.getState().currentTime, 30000);
  await service.play();
  assert.equal(players[0].playing, true);
  assert.equal(service.getState().isPlaying, true);
  await service.loadAndPlay(1, 1);
  assert.equal(service.getState().isPlaying, false);
  await service.loadAndPlay(1, 1);
  assert.equal(service.getState().isPlaying, true);
  assert.equal(players.length, 1);
  assert.equal(calls.filter(([name]) => name === 'play').length, 3);
  assert.equal(calls.some(([name]) => ['replace', 'remove', 'clearLockScreenControls', 'seekTo'].includes(name)), false);
});

test('stop clears native controls, removes the player and subscriptions, and ignores stale events', async (t) => {
  const { service, players, calls, appState, timers } = setup(t);
  let ended = 0;
  service.onEnded(() => { ended++; });
  await service.loadAndPlay(1, 1);
  players[0].emit({ currentTime: 42 });
  const staleListeners = [...players[0].listeners];
  await service.stop();
  assertStopped(service);
  assert.equal(players[0].playing, false);
  assert.equal(players[0].listeners.size, 0);
  assert.equal(timers.size, 0);
  assert.equal(calls.filter(([name]) => name === 'clearLockScreenControls').length, 1);
  assert.equal(calls.filter(([name]) => name === 'remove').length, 1);
  assert.equal(calls.filter(([name, active]) => name === 'setIsAudioActiveAsync' && active === false).length, 1);
  assert.ok(calls.findIndex(([name]) => name === 'remove') < calls.findIndex(([name, active]) => name === 'setIsAudioActiveAsync' && active === false));
  for (const listener of staleListeners) {
    listener({ ...players[0].currentStatus, playing: true, didJustFinish: true });
  }
  await appState('active');
  assertStopped(service);
  assert.equal(ended, 0);
  await service.stop();
  assert.equal(calls.filter(([name]) => name === 'remove').length, 1, 'Stop must be idempotent');
});

for (const [bibleBrain, existingPlayer] of [[false, false], [true, false], [false, true], [true, true]]) {
  test(`stop during deferred ${bibleBrain ? 'BibleBrain' : 'Drive'} download ${existingPlayer ? 'between chapters' : 'before first playback'} cannot restart playback`, async (t) => {
    const { service, players, calls } = setup(t);
    if (existingPlayer) await service.loadAndPlay(1, 1);
    if (bibleBrain) service.setBibleBrainMode('test-bible');
    const download = deferred();
    let downloading = false;
    service[bibleBrain ? 'getBibleBrainAudioLocalPath' : 'getOrDownloadAudioLocalPath'] = () => {
      downloading = true;
      return download.promise;
    };
    const loading = service.loadAndPlay(1, 2);
    await until(() => downloading, 'Download was not started');
    assert.equal(service.getState().isLoading, true);
    await service.stop();
    assertStopped(service);
    const boundary = calls.length;
    download.resolve('file:///test/deferred.mp3');
    await loading;
    assertStopped(service);
    assert.equal(players.length, existingPlayer ? 1 : 0);
    assert.equal(calls.slice(boundary).some(([name]) => ['createAudioPlayer', 'replace', 'play', 'setActiveForLockScreen'].includes(name)), false);
  });
}

for (const [bibleBrain, stopDuringLookup] of [[false, true], [true, true], [false, false], [true, false]]) {
  test(`actual ${bibleBrain ? 'BibleBrain' : 'Drive'} helper ignores stale state writes after stop during ${stopDuringLookup ? 'getInfoAsync' : 'download'}`, async (t) => {
    const { service, players, calls, fileSystem, downloadHelpers } = setup(t);
    Object.assign(service, downloadHelpers);
    service.resolveDriveFileId = async () => 'test-drive-file';
    if (bibleBrain) service.setBibleBrainMode('test-bible');
    const lookup = deferred();
    const download = deferred();
    const snapshots = [];
    let lookupStarted = false;
    let onProgress;
    fileSystem.getInfoAsync = async (uri) => {
      if (uri.endsWith('.mp3') && !lookupStarted) {
        lookupStarted = true;
        return lookup.promise;
      }
      return { exists: true, size: 4096 };
    };
    fileSystem.createDownloadResumable = (url, uri, options, progress) => {
      onProgress = progress;
      return { downloadAsync: () => download.promise };
    };
    service.addListener((state) => snapshots.push(state));
    const loading = service.loadAndPlay(1, 1);
    await until(() => lookupStarted, 'Real helper must reach the deferred file cache lookup');
    if (!stopDuringLookup) {
      lookup.resolve({ exists: false });
      await until(() => onProgress, 'Real helper must create a resumable download');
      onProgress({ totalBytesWritten: 25, totalBytesExpectedToWrite: 100 });
      assert.equal(service.getState().downloadProgress, 25, 'Current download must report progress before stop');
    }

    await service.stop();
    assertStopped(service);
    const stopped = service.getState();
    const snapshotBoundary = snapshots.length;
    const callBoundary = calls.length;
    if (stopDuringLookup) {
      lookup.resolve({ exists: false });
      await until(() => onProgress, 'Cancelled helper must reach its guarded download callbacks');
      assertStopped(service);
    }
    onProgress({ totalBytesWritten: 75, totalBytesExpectedToWrite: 100 });
    assertStopped(service);
    download.resolve({ status: 200 });
    await loading;
    assertStopped(service);
    onProgress({ totalBytesWritten: 100, totalBytesExpectedToWrite: 100 });
    assertStopped(service);
    for (const snapshot of snapshots.slice(snapshotBoundary)) {
      assert.deepEqual(snapshot, stopped, 'Stale helper must never publish dirty state after stop');
    }
    assert.equal(players.length, 0);
    assert.equal(calls.some(([name, active]) => name === 'setIsAudioActiveAsync' && active === false), true);
    assert.equal(calls.slice(callBoundary).some(([name]) => ['createAudioPlayer', 'play', 'setIsAudioActiveAsync'].includes(name)), false);
  });
}

test('stop cancels a pending native playback confirmation without a later timeout or restart', async (t) => {
  const { service, players, calls, timers, advance } = setup(t, { confirmPlay: false });
  const loading = service.loadAndPlay(1, 1);
  await until(() => calls.some(([name]) => name === 'play'), 'Native play was not requested');
  assert.equal(timers.size, 1);
  await service.stop();
  await loading;
  assertStopped(service);
  assert.equal(timers.size, 0);
  assert.equal(players[0].listeners.size, 0);
  const boundary = calls.length;
  advance(60000);
  assert.equal(calls.length, boundary);
});

for (const replacing of [false, true]) {
  test(`native play failure cleans up ${replacing ? 'a replaced' : 'the initial'} player and rejects loading`, async (t) => {
    const failure = new Error('Native playback failed');
    const { service, players, calls, timers } = setup(t, { playError: replacing ? null : failure });
    if (replacing) {
      await service.loadAndPlay(1, 1);
      players[0].playError = failure;
    }
    await assert.rejects(service.loadAndPlay(1, replacing ? 2 : 1), /Native playback failed/);
    assertStopped(service);
    assert.equal(players.length, 1);
    assert.equal(players[0].listeners.size, 0);
    assert.equal(timers.size, 0);
    assert.equal(calls.filter(([name]) => name === 'clearLockScreenControls').length, 1);
    assert.equal(calls.filter(([name]) => name === 'remove').length, 1);
  });
}

test('missing native playback confirmation times out and cleans up instead of reporting success', async (t) => {
  const { service, players, calls, timers, advance } = setup(t, { confirmPlay: false });
  const loading = service.loadAndPlay(1, 1);
  const rejected = assert.rejects(loading, /iniciar|start|reproduzir|play/i);
  await until(() => calls.some(([name]) => name === 'play'), 'Native play was not requested');
  assert.equal(service.getState().isPlaying, false);
  assert.equal(timers.size, 1);
  advance(60000);
  await rejected;
  assertStopped(service);
  assert.equal(timers.size, 0);
  assert.equal(players[0].listeners.size, 0);
  assert.equal(calls.filter(([name]) => name === 'clearLockScreenControls').length, 1);
  assert.equal(calls.filter(([name]) => name === 'remove').length, 1);
});
