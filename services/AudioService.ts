import { Audio, AVPlaybackStatus } from "expo-av";
import { Sound } from "expo-av/build/Audio";
import * as FileSystem from "expo-file-system/legacy";
import PlaybackNotificationService from "./PlaybackNotificationService";

interface AudioState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  sound: Sound | null;
  currentBookId: number | null;
  currentChapter: number | null;
  currentBookName?: string | null;
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
  };

  private listeners: Set<(state: AudioState) => void> = new Set();
  private endListeners: Set<() => void> = new Set();
  // Permite sobrepor pasta específica de áudios, depois usa pasta geral e por fim fallback hardcoded
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
    5: "deuteronomio",
    6: "josue",
    7: "juizes",
    8: "rute",
    9: "1samuel",
    10: "2samuel",
    11: "1reis",
    12: "2reis",
    13: "1cronicas",
    14: "2cronicas",
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
    46: "1corintios",
    47: "2corintios",
    48: "galatas",
    49: "efesios",
    50: "filipenses",
    51: "colossenses",
    52: "1tessalonicenses",
    53: "2tessalonicenses",
    54: "1timoteo",
    55: "2timoteo",
    56: "tito",
    57: "filemom",
    58: "hebreus",
    59: "tiago",
    60: "1pedro",
    61: "2pedro",
    62: "1joao",
    63: "2joao",
    64: "3joao",
    65: "judas",
    66: "apocalipse", // Como no exemplo: "apocalipse-7.mp3"
  };

  constructor() {
    this.initializeAudio();
    // Registrar handler de ações de notificação (play/pause/stop)
    PlaybackNotificationService.setActionHandler(async (action) => {
      try {
        switch (action) {
          case "PAUSE_ACTION":
            await this.pause();
            break;
          case "PLAY_ACTION":
            await this.play();
            break;
          case "STOP_ACTION":
            await this.stop();
            break;
          default:
            break;
        }
      } catch (e) {
        console.warn("Falha ao executar ação da notificação", action, e);
      }
    });
  }

  private async initializeAudio() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error("Error initializing audio:", error);
    }
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
    this.listeners.forEach((callback) => callback(this.state));
  }

  private getAudioFileName(bookId: number, chapter: number): string {
    const bookName = this.bookNameMapping[bookId];
    if (!bookName) {
      throw new Error(`Book not found for ID: ${bookId}`);
    }
    return `${bookName}-${chapter}.mp3`;
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
    const response = await fetch(listUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (!data.files || data.files.length === 0)
      throw new Error(`Audio file not found: ${fileName}`);
    const file = data.files[0];
    if (!file.id) throw new Error("File ID not found");
    return file.id;
  }

  async isAudioAvailable(bookId: number, chapter: number): Promise<boolean> {
    try {
      const fileName = this.getAudioFileName(bookId, chapter);
      
      await this.ensureAudioDir();
      const localPath = `${this.AUDIO_DIR}${fileName}`;
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists && info.size && info.size > 1024) {
        return true; 
      }
      
      await this.resolveDriveFileId(fileName);
      return true; 
    } catch (error) {
      console.log(`Audio not available for book ${bookId}, chapter ${chapter}:`, error);
      return false; 
    }
  }

  private async getOrDownloadAudioLocalPath(fileName: string): Promise<string> {
    await this.ensureAudioDir();
    const localPath = `${this.AUDIO_DIR}${fileName}`;
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists && info.size && info.size > 1024) {
      return localPath; // Já baixado
    }
    // Baixar - notifica que está baixando
    this.state.isLoading = true;
    this.notifyListeners();
    
    const fileId = await this.resolveDriveFileId(fileName);
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    const result = await FileSystem.downloadAsync(downloadUrl, localPath);
    if (result.status !== 200)
      throw new Error(`Falha ao baixar áudio (status ${result.status})`);
    return localPath;
  }

  async loadAndPlay(
    bookId: number,
    chapter: number,
    opts?: { bookName?: string }
  ): Promise<void> {
    try {
      // Se já está tocando o mesmo capítulo, apenas pausar/reproduzir
      if (
        this.state.currentBookId === bookId &&
        this.state.currentChapter === chapter &&
        this.state.sound
      ) {
        if (this.state.isPlaying) {
          await this.pause();
        } else {
          await this.play();
        }
        return;
      }

      await this.stop();

      this.state.isLoading = true;
      this.state.currentBookId = bookId;
      this.state.currentChapter = chapter;
      this.state.currentBookName = opts?.bookName || undefined;
      this.notifyListeners();

      const fileName = this.getAudioFileName(bookId, chapter);
      const localPath = await this.getOrDownloadAudioLocalPath(fileName);

      const { sound } = await Audio.Sound.createAsync(
        { uri: localPath },
        { shouldPlay: true },
        (status) => this.onPlaybackStatusUpdate(status)
      );

      this.state.sound = sound;
      this.state.isLoading = false;
      this.state.isPlaying = true;

      PlaybackNotificationService.showOrUpdate({
        bookName: this.state.currentBookName || this.bookNameMapping[bookId],
        chapter,
        currentTime: 0,
        duration: 0,
        isPlaying: true,
        loading: false,
      }).catch(() => {});

      this.prefetch(bookId, chapter + 1).catch(() => {});

      const initialStatus = await sound.getStatusAsync();
      this.onPlaybackStatusUpdate(initialStatus);

      this.notifyListeners();
    } catch (error) {
      console.error("Error loading audio:", error);
      this.state.isLoading = false;
      this.state.isPlaying = false;
      this.notifyListeners();

      // Re-throw com mensagem mais amigável
      if (error instanceof Error && /not found/i.test(error.message)) {
        throw new Error(`Áudio não disponível para este capítulo`);
      }
      throw new Error("Erro ao carregar áudio");
    }
  }

  async prefetch(bookId: number, chapter: number): Promise<boolean> {
    try {
      const fileName = this.getAudioFileName(bookId, chapter);
      await this.getOrDownloadAudioLocalPath(fileName);
      return true;
    } catch (e) {
      console.warn("Prefetch falhou", e);
      return false;
    }
  }

  async play(): Promise<void> {
    if (this.state?.sound && !this.state.isPlaying) {
      try {
        await this.state.sound.playAsync();
        this.state.isPlaying = true;
        this.notifyListeners();
        PlaybackNotificationService.showOrUpdate({
          bookName:
            this.state.currentBookName ||
            (this.state.currentBookId
              ? this.bookNameMapping[this.state.currentBookId]
              : ""),
          chapter: this.state.currentChapter || undefined,
          currentTime: this.state.currentTime,
          duration: this.state.duration,
          isPlaying: true,
        }).catch(() => {});
      } catch (error) {
        console.error("Error playing audio:", error);
      }
    }
  }

  async pause(): Promise<void> {
    if (this.state?.sound && this.state.isPlaying) {
      try {
        await this.state.sound.pauseAsync();
        this.state.isPlaying = false;
        this.notifyListeners();
        PlaybackNotificationService.showOrUpdate({
          bookName:
            this.state.currentBookName ||
            (this.state.currentBookId
              ? this.bookNameMapping[this.state.currentBookId]
              : ""),
          chapter: this.state.currentChapter || undefined,
          currentTime: this.state.currentTime,
          duration: this.state.duration,
          isPlaying: false,
        }).catch(() => {});
      } catch (error) {
        console.error("Error pausing audio:", error);
      }
    }
  }

  async stop(): Promise<void> {
    if (this.state?.sound) {
      try {
        await this.state.sound.stopAsync();
        await this.state.sound.unloadAsync();
      } catch (error) {
        console.error("Error stopping audio:", error);
      }
    }

    // Reset state regardless of sound status
    this.state.sound = null;
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    this.state.duration = 0;
    this.notifyListeners();
    PlaybackNotificationService.dismiss().catch(() => {});
  }

  async seekTo(positionMillis: number): Promise<void> {
    if (this.state?.sound) {
      try {
        await this.state.sound.setPositionAsync(positionMillis);
      } catch (error) {
        console.error("Error seeking audio:", error);
      }
    }
  }

  private onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      this.state.currentTime = status.positionMillis || 0;
      this.state.duration = status.durationMillis || 0;
      this.state.isPlaying = status.isPlaying;

      if (status.didJustFinish) {
        this.state.isPlaying = false;
        this.state.currentTime = 0;
        this.endListeners.forEach((l) => {
          try {
            l();
          } catch (e) {
            console.warn("onEnded listener error", e);
          }
        });
        PlaybackNotificationService.showOrUpdate({
          bookName:
            this.state.currentBookName ||
            (this.state.currentBookId
              ? this.bookNameMapping[this.state.currentBookId]
              : ""),
          chapter: this.state.currentChapter || undefined,
          currentTime: this.state.currentTime,
          duration: this.state.duration,
          isPlaying: false,
        }).catch(() => {});
      }

      this.notifyListeners();
    } else {
      console.log("Audio status not loaded:", status);
    }
  };

  getState(): AudioState {
    return { ...this.state };
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
