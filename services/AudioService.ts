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
  downloadProgress: number; // 0-100
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
  };

  private listeners: Set<(state: AudioState) => void> = new Set();
  private endListeners: Set<() => void> = new Set();
  private downloadProgressCallback: ((progress: number) => void) | null = null;
  private statusCheckInterval: NodeJS.Timeout | null = null; // Timer para polling manual
  private lastTriggeredEnd: number | null = null; // Evitar múltiplos disparos
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
      // Modo que permite reproduzir mesmo durante chamadas - compartilha o foco de áudio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true, // Abaixa volume de outros áudios em vez de bloquear
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 1, // DuckOthers - permite mixar com outros áudios
        interruptionModeAndroid: 1, // DuckOthers - permite reproduzir durante chamadas
      });
      console.log('[AudioService] Audio mode initialized with background support');
    } catch (error) {
      console.error("Error initializing audio:", error);
      // Tentar modo fallback mais simples
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (fallbackError) {
        console.error("Fallback audio initialization failed:", fallbackError);
      }
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
    } catch (_) {
      return false; 
    }
  }

  private async getOrDownloadAudioLocalPath(fileName: string, isPrefetch: boolean = false): Promise<string> {
    await this.ensureAudioDir();
    const localPath = `${this.AUDIO_DIR}${fileName}`;
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists && info.size && info.size > 1024) {
      return localPath; // Já baixado
    }
    
    // Só atualizar estado se NÃO for prefetch
    if (!isPrefetch) {
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
        if (!isPrefetch) {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          const progressPercent = Math.round(progress * 100);
          this.state.downloadProgress = progressPercent;
          this.notifyListeners();
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || result.status !== 200) {
      throw new Error(`Falha ao baixar áudio (status ${result?.status})`);
    }
    
    // Download completo - só atualizar se NÃO for prefetch
    if (!isPrefetch) {
      this.state.downloadProgress = 100;
      this.notifyListeners();
    }
    
    return localPath;
  }

  async loadAndPlay(
    bookId: number,
    chapter: number,
    opts?: { bookName?: string }
  ): Promise<void> {
    try {
      console.log('[AudioService] loadAndPlay called', { bookId, chapter, bookName: opts?.bookName });
      
      // Se já está tocando o mesmo capítulo, apenas pausar/reproduzir
      if (
        this.state.currentBookId === bookId &&
        this.state.currentChapter === chapter &&
        this.state.sound
      ) {
        console.log('[AudioService] Same chapter - toggling play/pause');
        if (this.state.isPlaying) {
          await this.pause();
        } else {
          await this.play();
        }
        return;
      }

      // Guardar referência do som antigo para descarregar DEPOIS
      const oldSound = this.state.sound;
      
      console.log('[AudioService] Preparing to load new audio');
      
      // Parar polling se houver
      this.stopStatusPolling();

      // Resetar flag de último disparo para permitir novo onEnded
      this.lastTriggeredEnd = null;

      console.log('[AudioService] Setting loading state');
      this.state.isLoading = true;
      this.state.currentBookId = bookId;
      this.state.currentChapter = chapter;
      this.state.currentBookName = opts?.bookName || undefined;
      this.notifyListeners();

      const fileName = this.getAudioFileName(bookId, chapter);
      console.log('[AudioService] Getting audio file:', fileName);
      const localPath = await this.getOrDownloadAudioLocalPath(fileName);
      console.log('[AudioService] Audio file ready at:', localPath);

      // Descarregar o som antigo AGORA, antes de criar o novo
      if (oldSound) {
        try {
          console.log('[AudioService] Unloading old sound...');
          
          const status = await oldSound.getStatusAsync();
          if (status.isLoaded) {
            if (status.isPlaying) {
              await oldSound.pauseAsync();
            }
            await oldSound.stopAsync();
          }
          await oldSound.unloadAsync();
          console.log('[AudioService] Old sound unloaded successfully');
        } catch (error) {
          console.error('[AudioService] Error unloading old sound:', error);
        }
      }
      
      // Limpar referência do som antigo
      this.state.sound = null;
      this.state.isPlaying = false;

      // Reinicializar o áudio antes de criar o som
      console.log('[AudioService] Initializing audio mode');
      await this.initializeAudio();

      // Criar o som com configuração para continuar em background
      console.log('[AudioService] Creating sound object');
      const { sound } = await Audio.Sound.createAsync(
        { uri: localPath },
        { 
          shouldPlay: false,
          progressUpdateIntervalMillis: 1000, // Atualizar progresso a cada 1 segundo
          isLooping: false,
        },
        (status) => this.onPlaybackStatusUpdate(status)
      );
      console.log('[AudioService] Sound object created');

      this.state.sound = sound;

      // Tentar reproduzir com retries
      let playSuccess = false;
      let retryCount = 0;
      const maxRetries = 5; // Aumentado para 5 tentativas

      console.log('[AudioService] Starting playback attempts');
      while (retryCount < maxRetries && !playSuccess) {
        try {
          console.log(`[AudioService] Playback attempt ${retryCount + 1}/${maxRetries}`);
          
          // Tentar reproduzir
          await sound.playAsync();
          playSuccess = true;
          console.log('[AudioService] Playback started successfully');
        } catch (error: any) {
          retryCount++;
          console.error(`[AudioService] Play attempt ${retryCount} failed:`, error?.message || error);
          
          // Se for erro de foco de áudio e ainda tem tentativas
          if (error?.message?.includes("AudioFocusNotAcquired") && retryCount < maxRetries) {
            console.log(`[AudioService] AudioFocus error, reconfiguring audio mode for retry ${retryCount}...`);
            
            // Tentar reinicializar o modo de áudio para liberar/readquirir o foco
            try {
              await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                interruptionModeAndroid: 1, // DuckOthers - permite mixar
                shouldDuckAndroid: true, // Abaixa volume em vez de bloquear
              });
              console.log(`[AudioService] Audio mode reconfigured, retrying...`);
            } catch (modeError) {
              console.error('[AudioService] Error reconfiguring audio mode:', modeError);
            }
          } else {
            // Se não for erro de foco ou acabaram as tentativas, propagar o erro
            console.error('[AudioService] Non-recoverable error or max retries reached');
            throw error;
          }
        }
      }

      if (!playSuccess) {
        console.error('[AudioService] Failed to play audio after all retries');
        throw new Error("Não foi possível reproduzir o áudio após múltiplas tentativas");
      }

      console.log('[AudioService] Setting final state - isPlaying: true, isLoading: false');
      this.state.isLoading = false;
      this.state.isPlaying = true;
      this.state.downloadProgress = 0; // Resetar progresso após sucesso

      const initialStatus = await sound.getStatusAsync();
      this.onPlaybackStatusUpdate(initialStatus);

      // Iniciar polling manual para detectar fim do áudio mesmo com tela bloqueada
      this.startStatusPolling();

      console.log('[AudioService] Notifying listeners - loadAndPlay complete');
      this.notifyListeners();
      console.log('[AudioService] loadAndPlay finished successfully');

      // Fazer prefetch e notificação DEPOIS de notificar o estado final
      PlaybackNotificationService.showOrUpdate({
        bookName: this.state.currentBookName || this.bookNameMapping[bookId],
        chapter,
        currentTime: 0,
        duration: 0,
        isPlaying: true,
        loading: false,
      }).catch(() => {});

      this.prefetch(bookId, chapter + 1).catch(() => {});
    } catch (error) {
      console.error("[AudioService] Error loading audio:", error);
      this.state.isLoading = false;
      this.state.isPlaying = false;
      this.state.downloadProgress = 0; // Resetar progresso em caso de erro
      this.notifyListeners();

      // Re-throw com mensagem mais amigável
      if (error instanceof Error) {
        if (/not found/i.test(error.message)) {
          throw new Error(`Áudio não disponível para este capítulo`);
        }
        if (/AudioFocusNotAcquired/i.test(error.message)) {
          throw new Error(`Não foi possível obter o foco de áudio. Tente fechar outros aplicativos de mídia e tente novamente.`);
        }
      }
      throw new Error("Erro ao carregar áudio");
    }
  }

  private startStatusPolling() {
    // Limpar qualquer polling anterior
    this.stopStatusPolling();
    
    console.log('[AudioService] Starting status polling');
    
    // Polling simples para atualizar UI e backup de detecção
    const poll = async () => {
      if (this.state.sound && this.statusCheckInterval) {
        try {
          const status = await this.state.sound.getStatusAsync();
          if (status.isLoaded) {
            this.state.currentTime = status.positionMillis || 0;
            this.state.duration = status.durationMillis || 0;
            this.state.isPlaying = status.isPlaying;
            
            // Notificar listeners sobre mudanças de estado
            this.notifyListeners();
          }
          
          // Agendar próximo poll
          if (this.statusCheckInterval) {
            this.statusCheckInterval = setTimeout(poll, 1000) as any;
          }
        } catch (error) {
          console.error('[AudioService] Error in status polling:', error);
        }
      }
    };
    
    // Iniciar polling
    this.statusCheckInterval = setTimeout(poll, 1000) as any;
  }

  private stopStatusPolling() {
    if (this.statusCheckInterval) {
      console.log('[AudioService] Stopping status polling');
      clearTimeout(this.statusCheckInterval as any);
      this.statusCheckInterval = null;
    }
  }

  private triggerEndListeners() {
    console.log('[AudioService] Triggering', this.endListeners.size, 'onEnded listeners');
    this.state.isPlaying = false;
    this.state.currentTime = 0;
    this.endListeners.forEach((l) => {
      try {
        console.log('[AudioService] Calling onEnded listener');
        l();
        console.log('[AudioService] onEnded listener executed successfully');
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

  async prefetch(bookId: number, chapter: number): Promise<boolean> {
    try {
      console.log('[AudioService] Prefetching next chapter:', { bookId, chapter });
      const fileName = this.getAudioFileName(bookId, chapter);
      await this.getOrDownloadAudioLocalPath(fileName, true); // isPrefetch = true
      console.log('[AudioService] Prefetch completed successfully');
      return true;
    } catch (e) {
      console.warn("[AudioService] Prefetch falhou", e);
      return false;
    }
  }

  async play(): Promise<void> {
    if (this.state?.sound && !this.state.isPlaying) {
      try {
        // Verificar se o som está carregado antes de reproduzir
        const status = await this.state.sound.getStatusAsync();
        console.log("Audio status before play:", { isLoaded: status.isLoaded });
        
        if (!status.isLoaded) {
          console.error("Audio status not loaded:", status);
          throw new Error("Áudio não está carregado");
        }

        // Reinicializar o modo de áudio antes de reproduzir
        await this.initializeAudio();
        
        await this.state.sound.playAsync();
        this.state.isPlaying = true;
        
        // Reiniciar polling ao retomar reprodução
        this.startStatusPolling();
        
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
      } catch (error: any) {
        console.error("Error playing audio:", error);
        
        // Se for erro de foco de áudio, mostrar mensagem específica
        if (error?.message?.includes("AudioFocusNotAcquired")) {
          throw new Error("Não foi possível obter o foco de áudio. Tente fechar outros aplicativos de mídia.");
        }
        throw error;
      }
    }
  }

  async pause(): Promise<void> {
    if (this.state?.sound && this.state.isPlaying) {
      try {
        await this.state.sound.pauseAsync();
        this.state.isPlaying = false;
        
        // Parar polling quando pausar
        this.stopStatusPolling();
        
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
    console.log('[AudioService] Stopping audio');
    
    // Parar polling de status
    this.stopStatusPolling();
    
    if (this.state?.sound) {
      try {
        // Primeiro pausar, depois parar, e por fim descarregar
        // Isso garante uma liberação suave do foco de áudio
        const status = await this.state.sound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await this.state.sound.pauseAsync();
        }
        await this.state.sound.stopAsync();
        await this.state.sound.unloadAsync();
        console.log('[AudioService] Sound unloaded successfully');
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
    console.log('[AudioService] Audio stopped, state reset');
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
      const currentTime = status.positionMillis || 0;
      const duration = status.durationMillis || 0;
      
      this.state.currentTime = currentTime;
      this.state.duration = duration;
      this.state.isPlaying = status.isPlaying;

      // Detectar fim do áudio apenas com didJustFinish (funciona bem com tela desbloqueada)
      if (status.didJustFinish) {
        console.log('[AudioService] Audio finished (didJustFinish)');
        
        // Evitar disparos duplicados
        const now = Date.now();
        const canTrigger = !this.lastTriggeredEnd || (now - this.lastTriggeredEnd) > 3000;
        
        if (canTrigger) {
          this.lastTriggeredEnd = now;
          this.triggerEndListeners();
          this.stopStatusPolling();
        }
      }
      
      this.notifyListeners();
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
