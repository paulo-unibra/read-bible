import {
  AudioPlayer,
  AudioStatus,
  createAudioPlayer,
  setAudioModeAsync,
  setIsAudioActiveAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { AppState, AppStateStatus } from "react-native";
import bibleBrainService from "./BibleBrainService";

const USFM_BOOK_ORDER = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
  '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
  'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
  'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH',
  'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS',
  '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
]

interface AudioState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  sound: AudioPlayer | null;
  currentBookId: number | null;
  currentChapter: number | null;
  currentBookName?: string | null;
  downloadProgress: number; // 0-100
  currentVerseNumber: number | null; // Versículo sendo narrado
  totalVerses: number; // Total de versículos do capítulo
  verseTimestamps: { verseNumber: number; timestampMs: number }[]; // Timestamps reais
}

class AudioService {
  private state: AudioState = {
    isPlaying: false,
    isLoading: false,
    currentTime: 0,
    duration: 0,
    sound: null,
    currentBookId: null,
    currentChapter: null,
    currentBookName: null,
    downloadProgress: 0,
    currentVerseNumber: null,
    totalVerses: 0,
    verseTimestamps: [],
  };

  private listeners: Set<(state: AudioState) => void> = new Set();
  private endListeners: Set<() => void> = new Set();
  private downloadProgressCallback: ((progress: number) => void) | null = null;
  private playbackSubscription: { remove(): void } | null = null;
  private endHandled = false;
  private loadVersion = 0;
  private cancelPendingPlay: (() => void) | null = null;
  // Permite sobrepor pasta específica de áudios, depois usa pasta geral e por fim fallback hardcoded
  private bibleBrainBibleId: string | null = null;

  setBibleBrainMode(bibleId: string | null) {
    console.log("[AudioService] setBibleBrainMode:", { bibleId });
    this.bibleBrainBibleId = bibleId;
    this.bibleBrainAudioCache.clear();
  }

  private mapBookIdToUsfm(bookId: number): string {
    return USFM_BOOK_ORDER[bookId - 1] || '';
  }

  private DRIVE_FOLDER_ID =
    process.env.EXPO_PUBLIC_AUDIO_DRIVE_FOLDER_ID ||
    process.env.EXPO_PUBLIC_DRIVE_FOLDER_ID ||
    "1oqKoOzUu1Ae6sFYlb6QI-wMN4aHjKYjw";
  private API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
  private AUDIO_DIR = `${FileSystem.documentDirectory}audio/`;

  // Mapeamento de nomes de livros bíblicos para o padrão dos arquivos de áudio
  // Baseado no exemplo fornecido: "apocalipse-7.mp3"
  private bookNameMapping: { [key: number]: string } = {
    // Antigo Testamento
    1: "genesis",
    2: "exodo",
    3: "levitico",
    4: "numeros",
    5: "deutoronomio",
    6: "josue",
    7: "juizes",
    8: "rute",
    9: "1-samuel",
    10: "2-samuel",
    11: "1-reis",
    12: "2-reis",
    13: "1-cronicas",
    14: "2-cronicas",
    15: "esdras",
    16: "neemias",
    17: "ester",
    18: "jo",
    19: "salmos",
    20: "proverbios",
    21: "eclesiastes",
    22: "cantares",
    23: "isaias",
    24: "jeremias",
    25: "lamentacoes",
    26: "ezequiel",
    27: "daniel",
    28: "oseias",
    29: "joel",
    30: "amos",
    31: "obadias",
    32: "jonas",
    33: "miqueias",
    34: "naum",
    35: "habacuque",
    36: "sofonias",
    37: "ageu",
    38: "zacarias",
    39: "malaquias",
    // Novo Testamento
    40: "mateus",
    41: "marcos",
    42: "lucas",
    43: "joao",
    44: "atos",
    45: "romanos",
    46: "1-corintios",
    47: "2-corintios",
    48: "galatas",
    49: "efesios",
    50: "filipenses",
    51: "colossenses",
    52: "1-tessalonicenses",
    53: "2-tessalonicenses",
    54: "1-timoteo",
    55: "2-timoteo",
    56: "tito",
    57: "filemom",
    58: "hebreus",
    59: "tiago",
    60: "1-pedro",
    61: "2-pedro",
    62: "1-joao",
    63: "2-joao",
    64: "3-joao",
    65: "judas",
    66: "apocalipse", // Como no exemplo: "apocalipse-7.mp3"
  };

  constructor() {
    AppState.addEventListener("change", this.handleAppStateChange);
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === "active") {
      console.log(
        "[AudioService] App voltou ao primeiro plano - reconciliando estado de reprodução",
      );
      this.reconcilePlaybackStatus().catch((error) => {
        console.warn("[AudioService] Falha ao reconciliar status:", error);
      });
    }
  };

  // Verifica o status real do som nativo. Serve como rede de segurança para
  // quando o polling/callback em JS foi pausado (tela bloqueada) e o áudio
  // terminou sem que o app conseguisse reagir a tempo.
  private async reconcilePlaybackStatus(): Promise<void> {
    if (!this.state.sound || !this.playbackSubscription) return;

    try {
      this.onPlaybackStatusUpdate(this.state.sound.currentStatus);
    } catch (error) {
      console.warn(
        "[AudioService] Erro ao consultar status para reconciliação:",
        error,
      );
    }
  }

  private async initializeAudio() {
    await setIsAudioActiveAsync(true);
    await setAudioModeAsync({
      allowsRecording: false,
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
      shouldRouteThroughEarpiece: false,
    });
  }

  addListener(callback: (state: AudioState) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onEnded(cb: () => void) {
    this.endListeners.add(cb);
    return () => this.endListeners.delete(cb);
  }

  private notifyListeners() {
    const snapshot = this.getState();
    this.listeners.forEach((callback) => callback(snapshot));
  }

  private getAudioFileName(bookId: number, chapter: number): string {
    const bookName = this.bookNameMapping[bookId];
    if (!bookName) {
      throw new Error(`Book not found for ID: ${bookId}`);
    }
    const fileName = `${bookName}-${chapter}.mp3`;
    console.log("[AudioService] Generated filename:", {
      bookId,
      bookName,
      chapter,
      fileName,
    });
    return fileName;
  }

  private async ensureAudioDir() {
    const info = await FileSystem.getInfoAsync(this.AUDIO_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(this.AUDIO_DIR, {
        intermediates: true,
      });
    }
  }

  private async resolveDriveFileId(fileName: string): Promise<string> {
    const listUrl = `https://www.googleapis.com/drive/v3/files?q='${this.DRIVE_FOLDER_ID}'+in+parents+and+name='${fileName}'&key=${this.API_KEY}&fields=files(id,name)`;
    console.log("[AudioService] Searching Drive for file:", fileName);
    console.log("[AudioService] Drive URL query:", listUrl);

    const response = await fetch(listUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    console.log("[AudioService] Drive search result:", data);

    if (!data.files || data.files.length === 0) {
      console.error("[AudioService] Audio file not found in Drive:", fileName);
      throw new Error(`Audio file not found: ${fileName}`);
    }

    const file = data.files[0];
    if (!file.id) throw new Error("File ID not found");

    console.log("[AudioService] Found file in Drive:", {
      id: file.id,
      name: file.name,
    });
    return file.id;
  }

  async isAudioAvailable(bookId: number, chapter: number): Promise<boolean> {
    try {
      if (this.bibleBrainBibleId) {
        console.log("[AudioService] Verificando audio BibleBrain", {
          bibleId: this.bibleBrainBibleId,
          bookId,
          chapter,
        });
        return this.hasAudioBibleBrain(bookId, chapter);
      }

      const fileName = this.getAudioFileName(bookId, chapter);

      await this.ensureAudioDir();
      const localPath = `${this.AUDIO_DIR}${fileName}`;
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists && info.size && info.size > 1024) {
        console.log("[AudioService] Audio Drive local encontrado", {
          fileName,
          localPath,
          size: info.size,
        });
        return true;
      }

      await this.resolveDriveFileId(fileName);
      return true;
    } catch (_) {
      return false;
    }
  }

  private bibleBrainAudioCache: Map<string, boolean> = new Map();

  private async hasAudioBibleBrain(bookId: number, chapter: number): Promise<boolean> {
    if (!this.bibleBrainBibleId) return false;
    const cacheKey = `${this.bibleBrainBibleId}-${bookId}-${chapter}`;
    const cached = this.bibleBrainAudioCache.get(cacheKey);
    if (cached !== undefined) return cached;
    try {
      const bookIdStr = this.mapBookIdToUsfm(bookId);
      await bibleBrainService.getAudioChapterUrl(
        this.bibleBrainBibleId,
        bookIdStr,
        chapter,
      );
      console.log("[AudioService] Audio BibleBrain disponivel", {
        bibleId: this.bibleBrainBibleId,
        bookId: bookIdStr,
        chapter,
      });
      this.bibleBrainAudioCache.set(cacheKey, true);
      return true;
    } catch (error) {
      console.log("[AudioService] Audio BibleBrain indisponivel", {
        bibleId: this.bibleBrainBibleId,
        bookId,
        chapter,
        error: error instanceof Error ? error.message : String(error),
      });
      this.bibleBrainAudioCache.set(cacheKey, false);
      return false;
    }
  }

  private async getOrDownloadAudioLocalPath(
    fileName: string,
    isPrefetch: boolean = false,
  ): Promise<string> {
    const version = this.loadVersion;
    await this.ensureAudioDir();
    const localPath = `${this.AUDIO_DIR}${fileName}`;
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists && info.size && info.size > 1024) {
      return localPath; // Já baixado
    }

    // Só atualizar estado se NÃO for prefetch
    if (!isPrefetch && version === this.loadVersion) {
      // Resetar progresso e notificar que está baixando
      this.state.downloadProgress = 0;
      this.state.isLoading = true;
      this.notifyListeners();
    }

    const fileId = await this.resolveDriveFileId(fileName);
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    // Download com callback de progresso
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      localPath,
      {},
      (downloadProgress) => {
        // Só atualizar progresso se NÃO for prefetch
        if (!isPrefetch && version === this.loadVersion) {
          const progress =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          const progressPercent = Math.round(progress * 100);
          this.state.downloadProgress = progressPercent;
          this.notifyListeners();
        }
      },
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || result.status !== 200) {
      throw new Error(`Falha ao baixar áudio (status ${result?.status})`);
    }

    // Download completo - só atualizar se NÃO for prefetch
    if (!isPrefetch && version === this.loadVersion) {
      this.state.downloadProgress = 100;
      this.notifyListeners();
    }

    return localPath;
  }

  private async getBibleBrainAudioLocalPath(
    fileName: string,
    bookId: number,
    chapter: number,
    isPrefetch: boolean = false,
  ): Promise<string> {
    const version = this.loadVersion;
    if (!this.bibleBrainBibleId) {
      throw new Error('BibleBrain mode not set');
    }

    const bibleBrainAudioDir = `${this.AUDIO_DIR}biblebrain/${this.bibleBrainBibleId}/`;
    const dirInfo = await FileSystem.getInfoAsync(bibleBrainAudioDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(bibleBrainAudioDir, { intermediates: true });
    }

    const localPath = `${bibleBrainAudioDir}${fileName}`;
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists && info.size && info.size > 1024) {
      console.log("[AudioService] Cache BibleBrain local encontrado", {
        bibleId: this.bibleBrainBibleId,
        fileName,
        localPath,
        size: info.size,
      });
      return localPath;
    }

    if (!isPrefetch && version === this.loadVersion) {
      this.state.downloadProgress = 0;
      this.state.isLoading = true;
      this.notifyListeners();
    }

    const bookIdStr = this.mapBookIdToUsfm(bookId);
    const audioInfo = await bibleBrainService.getAudioChapterUrl(
      this.bibleBrainBibleId,
      bookIdStr,
      chapter,
    );

    console.log("[AudioService] Baixando audio BibleBrain", {
      bibleId: this.bibleBrainBibleId,
      bookId: bookIdStr,
      chapter,
      fileName,
      localPath,
      remoteUrl: audioInfo.url,
      remoteSize: audioInfo.filesize,
    });

    const downloadResumable = FileSystem.createDownloadResumable(
      audioInfo.url,
      localPath,
      {},
      (downloadProgress) => {
        if (!isPrefetch && version === this.loadVersion) {
          const progress =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          const progressPercent = Math.round(progress * 100);
          this.state.downloadProgress = progressPercent;
          this.notifyListeners();
        }
      },
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || result.status !== 200) {
      throw new Error(`Falha ao baixar áudio BibleBrain (status ${result?.status})`);
    }

    const downloadedInfo = await FileSystem.getInfoAsync(localPath);
    console.log("[AudioService] Audio BibleBrain baixado", {
      bibleId: this.bibleBrainBibleId,
      fileName,
      localPath,
      status: result.status,
      size: downloadedInfo.exists ? downloadedInfo.size : null,
    });

    if (!isPrefetch && version === this.loadVersion) {
      this.state.downloadProgress = 100;
      this.notifyListeners();
    }

    return localPath;
  }

  async loadAndPlay(
    bookId: number,
    chapter: number,
    opts?: { bookName?: string },
  ): Promise<void> {
    if (this.state.isLoading) return;
    let version = this.loadVersion;
    try {
      console.log("[AudioService] loadAndPlay called", {
        bookId,
        chapter,
        bookName: opts?.bookName,
      });

      // Se já está tocando o mesmo capítulo, apenas pausar/reproduzir
      if (
        this.state.currentBookId === bookId &&
        this.state.currentChapter === chapter &&
        this.state.sound
      ) {
        console.log("[AudioService] Same chapter - toggling play/pause");
        if (this.state.isPlaying) {
          await this.pause();
        } else {
          await this.play();
        }
        return;
      }

      console.log("[AudioService] Preparing to load new audio");
      version = ++this.loadVersion;
      this.playbackSubscription?.remove();
      this.playbackSubscription = null;
      this.state.sound?.pause();

      console.log("[AudioService] Setting loading state");
      this.state.isLoading = true;
      this.state.isPlaying = false;
      this.notifyListeners();

      const fileName = this.getAudioFileName(bookId, chapter);
      console.log("[AudioService] Getting audio file:", fileName, this.bibleBrainBibleId ? "(BibleBrain)" : "(Drive)");
      const localPath = this.bibleBrainBibleId
        ? await this.getBibleBrainAudioLocalPath(fileName, bookId, chapter)
        : await this.getOrDownloadAudioLocalPath(fileName);
      if (version !== this.loadVersion) return;
      console.log("[AudioService] Audio file ready at:", localPath);
      await this.initializeAudio();
      if (version !== this.loadVersion) return;

      const metadata = {
        title: `${opts?.bookName || this.bookNameMapping[bookId]} ${chapter}`,
        artist: "Bíblia em Foco",
      };
      // Keep the native media service alive across source changes. Recreating
      // it while locked would require starting a foreground service in background.
      if (this.state.sound) {
        this.state.sound.replace({ uri: localPath });
        this.state.sound.updateLockScreenMetadata(metadata);
      } else {
        this.state.sound = createAudioPlayer({ uri: localPath }, {
          updateInterval: 1000,
          keepAudioSessionActive: true,
        });
        this.state.sound.setActiveForLockScreen(true, metadata, {
          showSeekBackward: true,
          showSeekForward: true,
        });
      }
      this.state.currentBookId = bookId;
      this.state.currentChapter = chapter;
      this.state.currentBookName = opts?.bookName;
      this.state.currentTime = 0;
      this.state.duration = 0;
      this.endHandled = false;
      this.playbackSubscription = this.state.sound.addListener(
        "playbackStatusUpdate",
        (status) => {
          if (version === this.loadVersion) this.onPlaybackStatusUpdate(status);
        },
      );
      await this.play();
      if (version !== this.loadVersion) return;
      this.state.isLoading = false;
      this.state.downloadProgress = 0; // Resetar progresso após sucesso
      this.notifyListeners();
      this.prefetch(bookId, chapter + 1).catch(() => {});
    } catch (error) {
      if (version !== this.loadVersion) return;
      console.error("[AudioService] Error loading audio:", error);
      await this.stop();

      // Re-throw com mensagem mais amigável
      if (error instanceof Error) {
        if (/not found/i.test(error.message)) {
          throw new Error(`Áudio não disponível para este capítulo`);
        }
        throw error;
      }
      throw new Error("Erro ao carregar áudio");
    }
  }

  private triggerEndListeners() {
    console.log(
      "[AudioService] Triggering",
      this.endListeners.size,
      "onEnded listeners",
    );
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    this.endListeners.forEach((l) => {
      try {
        console.log("[AudioService] Calling onEnded listener");
        l();
        console.log("[AudioService] onEnded listener executed successfully");
      } catch (e) {
        console.warn("onEnded listener error", e);
      }
    });
  }

  async prefetch(bookId: number, chapter: number): Promise<boolean> {
    try {
      console.log("[AudioService] Prefetching next chapter:", {
        bookId,
        chapter,
      });
      const fileName = this.getAudioFileName(bookId, chapter);
      if (this.bibleBrainBibleId) {
        await this.getBibleBrainAudioLocalPath(fileName, bookId, chapter, true);
      } else {
        await this.getOrDownloadAudioLocalPath(fileName, true); // isPrefetch = true
      }
      console.log("[AudioService] Prefetch completed successfully");
      return true;
    } catch (e) {
      console.warn("[AudioService] Prefetch falhou", e);
      return false;
    }
  }

  async play(): Promise<void> {
    const sound = this.state.sound;
    if (!sound || sound.playing) return;
    this.cancelPendingPlay?.();
    if (this.endHandled || sound.currentStatus.didJustFinish) {
      await sound.seekTo(0);
      this.endHandled = false;
    }
    if (sound !== this.state.sound) return;

    // play() is synchronous in expo-audio; wait for native confirmation instead
    // of reporting success when focus was denied or the file failed to load.
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        subscription.remove();
        this.cancelPendingPlay = null;
        if (error) reject(error);
        else resolve();
      };
      const subscription = sound.addListener("playbackStatusUpdate", () => {
        if (sound.playing) finish();
      });
      const timeout = setTimeout(() => {
        sound.pause();
        finish(new Error("Não foi possível iniciar o áudio. Tente reproduzir novamente."));
      }, 15000);
      this.cancelPendingPlay = () => finish(new Error("Reprodução cancelada"));
      try {
        sound.play();
      } catch (error) {
        finish(error instanceof Error ? error : new Error("Erro ao reproduzir áudio"));
      }
    });
  }

  async pause(): Promise<void> {
    this.cancelPendingPlay?.();
    this.state.sound?.pause();
    this.state.isPlaying = false;
    this.notifyListeners();
  }

  async stop(): Promise<void> {
    console.log("[AudioService] Stopping audio");

    this.loadVersion++;
    this.cancelPendingPlay?.();
    this.playbackSubscription?.remove();
    this.playbackSubscription = null;

    if (this.state?.sound) {
      try {
        this.state.sound.pause();
        this.state.sound.clearLockScreenControls();
        this.state.sound.remove();
        console.log("[AudioService] Sound unloaded successfully");
      } catch (error) {
        console.error("Error stopping audio:", error);
      }
    }

    // Reset state regardless of sound status
    this.state.sound = null;
    this.state.isPlaying = false;
    this.state.isLoading = false; // Garantir que loading também seja resetado
    this.state.downloadProgress = 0;
    this.state.currentTime = 0;
    this.state.duration = 0;
    this.state.currentBookId = null;
    this.state.currentChapter = null;
    console.log("[AudioService] Audio stopped, state reset");
    this.notifyListeners();
    this.endHandled = false;
    await setIsAudioActiveAsync(false);
  }

  async seekTo(positionMillis: number): Promise<void> {
    if (this.state?.sound) {
      try {
        await this.state.sound.seekTo(positionMillis / 1000);
        if (positionMillis < this.state.duration) this.endHandled = false;
      } catch (error) {
        console.error("Error seeking audio:", error);
      }
    }
  }

  private onPlaybackStatusUpdate = (status: AudioStatus) => {
    const current = this.state.sound?.currentStatus;
    if (!current) return;
    // A persistent player can deliver queued events from the previous source.
    // Read live state; only preserve iOS's event-only end flag at the actual end.
    status = {
      ...current,
      didJustFinish: current.didJustFinish || (
        status.didJustFinish && !current.playing && current.duration > 0 &&
        current.currentTime >= current.duration
      ),
    };
    if (status.isLoaded) {
      const currentTime = (status.currentTime || 0) * 1000;
      const duration = (status.duration || 0) * 1000;

      this.state.currentTime = currentTime;
      this.state.duration = duration;
      this.state.isPlaying = status.playing;

      // Calcular versículo atual
      if (this.state.verseTimestamps.length > 0) {
        // Usar timestamps reais se disponíveis
        let currentVerse = 1;
        for (let i = 0; i < this.state.verseTimestamps.length; i++) {
          if (currentTime >= this.state.verseTimestamps[i].timestampMs) {
            currentVerse = this.state.verseTimestamps[i].verseNumber;
          } else {
            break;
          }
        }
        this.state.currentVerseNumber = currentVerse;
      } else if (this.state.totalVerses > 0 && duration > 0) {
        // Fallback: calcular baseado no tempo (método antigo)
        const progress = currentTime / duration;
        const estimatedVerse =
          Math.floor(progress * this.state.totalVerses) + 1;
        this.state.currentVerseNumber = Math.min(
          estimatedVerse,
          this.state.totalVerses,
        );
      }

      // Android reports didJustFinish on every status while ended. Handle once
      // per source, not once every few seconds, including after unlocking.
      if (status.didJustFinish && !this.endHandled) {
        console.log("[AudioService] Audio finished (didJustFinish)");
        this.endHandled = true;
        this.triggerEndListeners();
      }

      this.notifyListeners();
    }
  };

  getState(): AudioState {
    return { ...this.state };
  }

  setTotalVerses(totalVerses: number): void {
    this.state.totalVerses = totalVerses;
    this.state.currentVerseNumber = 1;
    this.notifyListeners();
  }

  async fetchVerseTimestamps(
    bookId: number,
    chapterNumber: number,
  ): Promise<void> {
    try {
      if (this.bibleBrainBibleId) {
        const bookIdStr = this.mapBookIdToUsfm(bookId);
        const timestamps = await bibleBrainService.getAudioTimestamps(
          this.bibleBrainBibleId,
          bookIdStr,
          chapterNumber,
        );
        if (timestamps.length > 0) {
          this.state.verseTimestamps = timestamps;
          console.log(
            `[AudioService] Loaded ${timestamps.length} BibleBrain timestamps for chapter`,
          );
        } else {
          this.state.verseTimestamps = [];
          console.log("[AudioService] No BibleBrain timestamps found");
        }
      } else {
        const API_URL =
          process.env.EXPO_PUBLIC_API_URL || "http://localhost:3333";
        const response = await fetch(
          `${API_URL}/audio-sync/${bookId}/${chapterNumber}`,
        );
        const data = await response.json();

        if (data.success && data.data && data.data.length > 0) {
          this.state.verseTimestamps = data.data;
          console.log(
            `[AudioService] Loaded ${data.data.length} timestamps for chapter`,
          );
        } else {
          this.state.verseTimestamps = [];
          console.log(
            "[AudioService] No timestamps found, using calculation fallback",
          );
        }
      }
    } catch (error) {
      console.error("[AudioService] Error fetching timestamps:", error);
      this.state.verseTimestamps = [];
    }
  }

  isCurrentChapter(bookId: number, chapter: number): boolean {
    return (
      this.state.currentBookId === bookId &&
      this.state.currentChapter === chapter
    );
  }

  formatTime(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this.listeners.clear();
  }
}

export default new AudioService();
