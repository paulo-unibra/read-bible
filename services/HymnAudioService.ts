import { Audio } from "expo-av";
import Constants from "expo-constants";
import hymnCacheService from "./HymnCacheService";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  "http://localhost:3333";

export interface HymnAudioTrack {
  instrument: string; // 'voz', 'teclado', etc.
  fileId: string;
  downloadUrl: string;
  sound?: Audio.Sound;
  volume: number; // 0 a 1
  isMuted: boolean;
  isLoaded: boolean;
  offsetMs?: number; // Offset de sincronização do backend
  displayOrder?: number; // Ordem de exibição
  hymnNumber?: number; // Número do hino (para cache)
}

export interface HymnAudioState {
  tracks: HymnAudioTrack[];
  isPlaying: boolean;
  position: number;
  duration: number;
}

class HymnAudioService {
  /**
   * Busca todos os áudios disponíveis para um hino específico
   * Primeiro tenta buscar do backend (com sincronização), se falhar busca do Drive
   * Se offline, busca apenas os áudios em cache local
   */
  async searchHymnAudios(hymnNumber: number): Promise<HymnAudioTrack[]> {
    try {
      console.log(
        `🎵 [HymnAudioService] Buscando áudios do hino ${hymnNumber}...`,
      );

      // Tentar buscar do backend primeiro (com dados de sincronização)
      try {
        console.log(
          `☁️ [HymnAudioService] Buscando sincronização do backend...`,
        );
        const response = await fetch(
          `${API_URL}/hymn-audios/${hymnNumber}?direct=true`,
        );

        if (response.ok) {
          const data = await response.json();

          if (data.success && data.data && data.data.length > 0) {
            console.log(
              `✅ [HymnAudioService] Encontrados ${data.data.length} áudios sincronizados no backend`,
            );

            // Mapear dados do backend para HymnAudioTrack
            const tracks: HymnAudioTrack[] = data.data.map((audio: any) => {
              const isTeclado = audio.instrument.toLowerCase() === "teclado";
              return {
                instrument: audio.instrument,
                fileId: audio.fileId,
                downloadUrl: audio.downloadUrl, // Já vem com URL direta do Drive
                volume: isTeclado ? 0.4 : audio.defaultVolume || 1.0,
                isMuted: audio.defaultMuted || false,
                isLoaded: false,
                offsetMs: audio.offsetMs || 0,
                displayOrder: audio.displayOrder || 0,
                hymnNumber, // Adicionar número do hino
              };
            });

            // Ordenar por displayOrder
            tracks.sort(
              (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0),
            );

            return tracks;
          }
        }
      } catch (backendError) {
        console.warn(
          `⚠️ [HymnAudioService] Erro ao buscar do backend, tentando Drive diretamente:`,
          backendError,
        );
      }

      console.log(`💾 [HymnAudioService] Buscando áudios em cache local...`);
      return await this.getCachedTracks(hymnNumber);
    } catch (error) {
      console.error("[HymnAudioService] Erro ao buscar áudios:", error);
      // Em caso de erro total, buscar do cache local
      console.log(
        `💾 [HymnAudioService] Fallback: buscando áudios em cache local...`,
      );
      return await this.getCachedTracks(hymnNumber);
    }
  }

  /**
   * Busca áudios disponíveis apenas do cache local (modo offline)
   */
  private async getCachedTracks(hymnNumber: number): Promise<HymnAudioTrack[]> {
    try {
      console.log(
        `💾 [HymnAudioService] Verificando cache para hino ${hymnNumber}...`,
      );

      const cacheDir = hymnCacheService["getCacheDir"]();
      const fileInfo = await hymnCacheService["initialize"]();

      // Ler todos os arquivos do cache
      const FileSystem = require("expo-file-system/legacy");
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        console.log(`📁 [HymnAudioService] Diretório de cache não existe`);
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(cacheDir);
      const hymnFiles = files.filter(
        (file: string) =>
          file.startsWith(`hino-${hymnNumber}-`) && file.endsWith(".mp3"),
      );

      if (hymnFiles.length === 0) {
        console.log(
          `📁 [HymnAudioService] Nenhum áudio em cache para hino ${hymnNumber}`,
        );
        return [];
      }

      console.log(
        `✅ [HymnAudioService] ${hymnFiles.length} áudios encontrados em cache:`,
        hymnFiles,
      );

      // Criar tracks baseado nos arquivos em cache
      const tracks: HymnAudioTrack[] = hymnFiles.map((fileName: string) => {
        // Extrair instrumento do nome do arquivo: hino-123-voz.mp3
        const match = fileName.match(/^hino-\d+-(.+)\.mp3$/);
        const instrument = match ? match[1] : fileName.replace(".mp3", "");
        const isTeclado = instrument.toLowerCase() === "teclado";

        return {
          instrument,
          fileId: "", // Não precisa de fileId para cache local
          downloadUrl: `${cacheDir}${fileName}`, // Usar caminho local
          volume: isTeclado ? 0.4 : 1.0,
          isMuted: false,
          isLoaded: false,
          offsetMs: 0,
          displayOrder: 0,
          hymnNumber,
        };
      });

      return tracks;
    } catch (error) {
      console.error(`❌ [HymnAudioService] Erro ao buscar cache:`, error);
      return [];
    }
  }

  /**
   * Carrega um áudio específico
   * PRIORIDADE 1: Arquivo local em cache (máxima performance e estabilidade)
   * PRIORIDADE 2: Streaming via backend (com Range support)
   * PRIORIDADE 3: Download direto do Google Drive
   *
   * @param track - Track com URL do arquivo local ou remoto
   * @returns Audio.Sound carregado ou null em caso de erro
   */
  async loadTrack(track: HymnAudioTrack): Promise<Audio.Sound | null> {
    try {
      console.log(`📥 [HymnAudioService] Carregando: ${track.instrument}...`);

      const isLocalUri =
        track.downloadUrl.startsWith("file://") ||
        track.downloadUrl.startsWith("content://");

      if (isLocalUri) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: track.downloadUrl },
          {
            shouldPlay: false,
            volume: track.volume,
            progressUpdateIntervalMillis: 100,
          },
        );

        console.log(
          `✅ [HymnAudioService] ${track.instrument} carregado de arquivo local`,
        );
        return sound;
      }

      // PRIORIDADE 1: Verificar se existe em cache local
      if (track.hymnNumber) {
        const cacheStatus = await hymnCacheService.isCached(
          track.hymnNumber,
          track.instrument,
        );

        if (cacheStatus.isCached && cacheStatus.localPath) {
          console.log(
            `💾 [HymnAudioService] Carregando do cache: ${track.instrument}`,
          );

          try {
            const { sound } = await Audio.Sound.createAsync(
              { uri: cacheStatus.localPath },
              {
                shouldPlay: false,
                volume: track.volume,
                progressUpdateIntervalMillis: 100,
              },
            );

            console.log(
              `✅ [HymnAudioService] ${track.instrument} carregado do cache local`,
            );
            return sound;
          } catch (localError) {
            console.warn(
              `⚠️ [HymnAudioService] Erro ao carregar do cache, tentando streaming:`,
              localError,
            );
            // Continua para tentar streaming
          }
        } else {
          console.log(
            `ℹ️ [HymnAudioService] ${track.instrument} não está em cache, usando streaming`,
          );
        }
      }

      // PRIORIDADE 2: Streaming do backend (com Range support)
      const streamUrl = `${API_URL}/hymn-audios/stream/${track.fileId}`;

      console.log(`🌊 [HymnAudioService] Carregando via backend: ${streamUrl}`);

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: streamUrl },
          {
            shouldPlay: false,
            volume: track.volume,
            progressUpdateIntervalMillis: 100,
          },
        );

        console.log(
          `✅ [HymnAudioService] ${track.instrument} carregado via streaming`,
        );
        return sound;
      } catch (streamError) {
        // PRIORIDADE 3: Fallback para URL direta do Google Drive
        console.log(
          `⚠️ [HymnAudioService] Backend falhou, tentando Drive direto...`,
        );

        const downloadUrl = `https://drive.google.com/uc?export=download&id=${track.fileId}`;

        const { sound } = await Audio.Sound.createAsync(
          { uri: downloadUrl },
          {
            shouldPlay: false,
            volume: track.volume,
            progressUpdateIntervalMillis: 100,
          },
        );

        console.log(
          `✅ [HymnAudioService] ${track.instrument} carregado via Drive`,
        );
        return sound;
      }
    } catch (error) {
      console.error(
        `❌ [HymnAudioService] Erro ao carregar ${track.instrument}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Aguarda até que um áudio esteja totalmente carregado e pronto
   */
  async waitForAudioReady(
    sound: Audio.Sound,
    instrument: string,
    maxWaitMs: number = 5000,
  ): Promise<boolean> {
    const startTime = Date.now();
    let attempts = 0;

    while (Date.now() - startTime < maxWaitMs) {
      attempts++;
      try {
        const status = await sound.getStatusAsync();

        if (
          status.isLoaded &&
          status.durationMillis &&
          status.durationMillis > 0
        ) {
          // Verificar se consegue obter a posição (indica que está realmente pronto)
          if (status.positionMillis !== undefined) {
            console.log(
              `✅ [HymnAudioService] ${instrument} pronto após ${attempts} tentativas (${Date.now() - startTime}ms, duração: ${status.durationMillis}ms)`,
            );
            return true;
          }
        }
      } catch (error) {
        console.warn(
          `⚠️ [HymnAudioService] Erro ao verificar status de ${instrument}:`,
          error,
        );
      }

      // Aguardar 50ms antes de verificar novamente
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.warn(
      `⚠️ [HymnAudioService] ${instrument} não ficou pronto após ${maxWaitMs}ms`,
    );
    return false;
  }

  /**
   * Carrega todos os áudios
   */
  async loadAllTracks(tracks: HymnAudioTrack[]): Promise<HymnAudioTrack[]> {
    const startTime = Date.now();
    console.log(
      `⏱️ [TIMER] loadAllTracks iniciado para ${tracks.length} áudios`,
    );

    const loadedTracks = await Promise.all(
      tracks.map(async (track) => {
        const trackStartTime = Date.now();
        try {
          const sound = await this.loadTrack(track);

          if (sound) {
            // Aguardar até que o áudio esteja totalmente pronto
            const isReady = await this.waitForAudioReady(
              sound,
              track.instrument,
            );

            if (isReady) {
              // Garantir que está na posição 0
              await sound.setPositionAsync(0);
            }
          }

          const trackEndTime = Date.now();
          console.log(
            `⏱️ [TIMER] Track ${track.instrument} carregado em ${trackEndTime - trackStartTime}ms`,
          );
          return {
            ...track,
            sound: sound || undefined,
            isLoaded: sound !== null,
          };
        } catch (error) {
          console.error(
            `❌ [HymnAudioService] Erro ao carregar track ${track.instrument}:`,
            error,
          );
          // Retornar track sem áudio carregado em caso de erro
          return {
            ...track,
            sound: undefined,
            isLoaded: false,
          };
        }
      }),
    );

    const successCount = loadedTracks.filter((t) => t.isLoaded).length;
    const totalTime = Date.now() - startTime;
    console.log(
      `⏱️ [TIMER] loadAllTracks concluído: ${successCount}/${tracks.length} áudios em ${totalTime}ms`,
    );
    console.log(
      `⏱️ [TIMER] Timer mestre cuidará da sincronização no playAll()`,
    );

    // Retornar apenas os tracks que carregaram com sucesso
    return loadedTracks.filter((t) => t.isLoaded);
  }

  /**
   * Sincroniza todos os áudios para uma posição específica (TIMER MESTRE)
   * Garante que todos os áudios estejam exatamente na mesma posição
   */
  async syncAllToPosition(
    tracks: HymnAudioTrack[],
    positionMs: number,
  ): Promise<void> {
    const loadedTracks = tracks.filter((t) => t.sound && t.isLoaded);

    if (loadedTracks.length === 0) return;

    await Promise.all(
      loadedTracks.map((track) =>
        track
          .sound!.setPositionAsync(positionMs)
          .catch((err) =>
            console.error(
              `[HymnAudioService] Erro ao sincronizar ${track.instrument}:`,
              err,
            ),
          ),
      ),
    );
  }

  /**
   * Toca todos os áudios sincronizados usando TIMER MESTRE
   * Os áudios sempre têm a mesma duração, então sincronizamos pela posição
   * FOCO: Sincronização PERFEITA no início, depois deixa tocar naturalmente
   */
  async playAll(
    tracks: HymnAudioTrack[],
    fromStart: boolean = false,
  ): Promise<void> {
    console.log(
      `▶️ [HymnAudioService] Tocando todos os áudios (timer mestre)...`,
    );

    // Filtrar apenas tracks carregados
    const loadedTracks = tracks.filter((t) => t.sound && t.isLoaded);

    if (loadedTracks.length === 0) {
      console.error(`❌ [HymnAudioService] Nenhum áudio carregado para tocar`);
      throw new Error("Nenhum áudio disponível para reprodução");
    }

    console.log(
      `▶️ [HymnAudioService] ${loadedTracks.length}/${tracks.length} áudios prontos`,
    );

    // Ajustar volume antes de tocar
    await Promise.all(
      loadedTracks.map((track) =>
        track.sound!.setVolumeAsync(track.isMuted ? 0 : track.volume),
      ),
    );

    // Se for para iniciar do zero, usar timer mestre em 0ms
    if (fromStart) {
      console.log(
        `⏱️ [HymnAudioService] TIMER MESTRE: Sincronização PERFEITA em 0ms...`,
      );

      // ETAPA 1: Parar todos completamente (sequencial para garantir)
      for (const track of loadedTracks) {
        await track.sound!.stopAsync();
      }
      console.log(`✅ Todos parados`);

      // ETAPA 2: Sincronizar TODOS para posição 0 usando timer mestre
      await Promise.all(
        loadedTracks.map((track) => track.sound!.setPositionAsync(0)),
      );
      console.log(`✅ Todos em 0ms`);

      // ETAPA 3: Delay maior para garantir estabilização
      await new Promise((resolve) => setTimeout(resolve, 200));
      console.log(`✅ Estabilizado`);
    }

    // Tocar todos SIMULTANEAMENTE usando Promise.all para máxima sincronia
    console.log(`▶️ [HymnAudioService] Iniciando playback sincronizado...`);
    const playPromises = loadedTracks.map((track) => track.sound!.playAsync());
    await Promise.all(playPromises);

    console.log(
      `✅ [HymnAudioService] Todos os áudios iniciados com timer mestre - deixando tocar naturalmente`,
    );
  }

  /**
   * Pausa todos os áudios simultaneamente
   * Preserva a posição atual para permitir resume
   */
  async pauseAll(tracks: HymnAudioTrack[]): Promise<void> {
    console.log(`⏸️ [HymnAudioService] Pausando todos os áudios...`);

    const loadedTracks = tracks.filter((t) => t.sound && t.isLoaded);

    // Pausar todos simultaneamente para manter sincronização
    await Promise.all(
      loadedTracks.map((track) =>
        track
          .sound!.pauseAsync()
          .catch((err) =>
            console.error(
              `[HymnAudioService] Erro ao pausar ${track.instrument}:`,
              err,
            ),
          ),
      ),
    );

    console.log(`✅ [HymnAudioService] Todos os áudios pausados`);
  }

  /**
   * Para todos os áudios e volta ao início
   * Garante que todas as faixas parem juntas e resetem para posição 0
   */
  async stopAll(tracks: HymnAudioTrack[]): Promise<void> {
    console.log(`⏹️ [HymnAudioService] Parando todos os áudios...`);

    const loadedTracks = tracks.filter((t) => t.sound && t.isLoaded);

    // Parar todos simultaneamente
    await Promise.all(
      loadedTracks.map((track) =>
        track
          .sound!.stopAsync()
          .catch((err) =>
            console.error(
              `[HymnAudioService] Erro ao parar ${track.instrument}:`,
              err,
            ),
          ),
      ),
    );

    // Resetar posição de todos para 0ms simultaneamente
    await Promise.all(
      loadedTracks.map((track) =>
        track
          .sound!.setPositionAsync(0)
          .catch((err) =>
            console.error(
              `[HymnAudioService] Erro ao resetar ${track.instrument}:`,
              err,
            ),
          ),
      ),
    );

    console.log(`✅ [HymnAudioService] Todos os áudios parados e resetados`);
  }

  /**
   * Ajusta o volume de um áudio específico
   */
  async setTrackVolume(track: HymnAudioTrack, volume: number): Promise<void> {
    if (track.sound && track.isLoaded) {
      await track.sound.setVolumeAsync(volume);
    }
  }

  /**
   * Muta/desmuta um áudio específico
   */
  async toggleMute(track: HymnAudioTrack): Promise<void> {
    if (track.sound && track.isLoaded) {
      const newVolume = track.isMuted ? track.volume : 0;
      await track.sound.setVolumeAsync(newVolume);
    }
  }

  /**
   * Busca a posição atual de reprodução (pega do primeiro áudio)
   */
  async getPosition(tracks: HymnAudioTrack[]): Promise<number> {
    const firstTrack = tracks.find((t) => t.sound && t.isLoaded);
    if (!firstTrack || !firstTrack.sound) return 0;

    const status = await firstTrack.sound.getStatusAsync();
    if (status.isLoaded) {
      return status.positionMillis;
    }
    return 0;
  }

  /**
   * Busca a duração total (pega do primeiro áudio)
   */
  async getDuration(tracks: HymnAudioTrack[]): Promise<number> {
    const firstTrack = tracks.find((t) => t.sound && t.isLoaded);
    if (!firstTrack || !firstTrack.sound) return 0;

    const status = await firstTrack.sound.getStatusAsync();
    if (status.isLoaded && status.durationMillis) {
      return status.durationMillis;
    }
    return 0;
  }

  /**
   * Define a posição de reprodução para todos os áudios
   */
  async seekAll(
    tracks: HymnAudioTrack[],
    positionMillis: number,
  ): Promise<void> {
    console.log(
      `⏩ [HymnAudioService] Buscando posição ${positionMillis}ms...`,
    );

    const loadedTracks = tracks.filter((t) => t.sound && t.isLoaded);

    // Verificar se estava tocando
    const wasPlaying = await Promise.all(
      loadedTracks.map(async (track) => {
        const status = await track.sound!.getStatusAsync();
        return status.isLoaded ? status.isPlaying : false;
      }),
    );
    const shouldResume = wasPlaying.some((playing) => playing);

    // PAUSAR TODOS primeiro
    if (shouldResume) {
      await Promise.all(
        loadedTracks.map((track) => track.sound!.pauseAsync().catch(() => {})),
      );
    }

    // POSICIONAR TODOS na mesma posição
    await Promise.all(
      loadedTracks.map((track) =>
        track.sound!.setPositionAsync(positionMillis),
      ),
    );

    // RETOMAR se estava tocando
    if (shouldResume) {
      await Promise.all(
        loadedTracks
          .filter((track) => !track.isMuted)
          .map((track) => track.sound!.playAsync()),
      );
    }
  }

  /**
   * Define a velocidade de reprodução para todos os áudios
   */
  async setPlaybackRateAll(
    tracks: HymnAudioTrack[],
    rate: number,
  ): Promise<void> {
    console.log(`⚡ [HymnAudioService] Alterando velocidade para ${rate}x...`);

    const loadedTracks = tracks.filter((t) => t.sound && t.isLoaded);

    try {
      await Promise.all(
        loadedTracks.map(async (track) => {
          try {
            await track.sound!.setRateAsync(rate, true); // true = pitch correction
            console.log(
              `✅ [HymnAudioService] ${track.instrument} velocidade alterada para ${rate}x`,
            );
          } catch (error) {
            console.error(
              `❌ [HymnAudioService] Erro ao alterar velocidade de ${track.instrument}:`,
              error,
            );
          }
        }),
      );

      console.log(
        `✅ [HymnAudioService] Velocidade de todos os áudios alterada para ${rate}x`,
      );
    } catch (error) {
      console.error(`❌ [HymnAudioService] Erro ao alterar velocidade:`, error);
      throw error;
    }
  }

  /**
   * Descarrega todos os áudios da memória
   */
  async unloadAll(tracks: HymnAudioTrack[]): Promise<void> {
    console.log(`🗑️ [HymnAudioService] Descarregando todos os áudios...`);

    const unloadPromises = tracks
      .filter((t) => t.sound)
      .map(async (track) => {
        try {
          await track.sound!.unloadAsync();
        } catch (error) {
          console.error(
            `[HymnAudioService] Erro ao descarregar ${track.instrument}:`,
            error,
          );
        }
      });

    await Promise.all(unloadPromises);

    console.log(`✅ [HymnAudioService] Áudios descarregados`);
  }
}

export default new HymnAudioService();
