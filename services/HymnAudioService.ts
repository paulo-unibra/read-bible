import { Audio } from 'expo-av';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3333';

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
}

export interface HymnAudioState {
  tracks: HymnAudioTrack[];
  isPlaying: boolean;
  position: number;
  duration: number;
}

class HymnAudioService {
  private readonly AUDIO_FOLDER_ID = '1kpVk7VeWDts852XfWk9fZRIgjwa8OYoN';
  private readonly API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;

  /**
   * Busca todos os áudios disponíveis para um hino específico
   * Primeiro tenta buscar do backend (com sincronização), se falhar busca do Drive
   */
  async searchHymnAudios(hymnNumber: number): Promise<HymnAudioTrack[]> {
    try {
      console.log(`🎵 [HymnAudioService] Buscando áudios do hino ${hymnNumber}...`);
      
      // Tentar buscar do backend primeiro (com dados de sincronização)
      try {
        console.log(`☁️ [HymnAudioService] Buscando sincronização do backend...`);
        const response = await fetch(`${API_URL}/hymn-audios/${hymnNumber}?direct=true`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.data && data.data.length > 0) {
            console.log(`✅ [HymnAudioService] Encontrados ${data.data.length} áudios sincronizados no backend`);
            
            // Mapear dados do backend para HymnAudioTrack
            const tracks: HymnAudioTrack[] = data.data.map((audio: any) => {
              const isTeclado = audio.instrument.toLowerCase() === 'teclado';
              return {
                instrument: audio.instrument,
                fileId: audio.fileId,
                downloadUrl: audio.downloadUrl, // Já vem com URL direta do Drive
                volume: isTeclado ? 0.4 : (audio.defaultVolume || 1.0),
                isMuted: audio.defaultMuted || false,
                isLoaded: false,
                offsetMs: audio.offsetMs || 0,
                displayOrder: audio.displayOrder || 0,
              };
            });
            
            // Ordenar por displayOrder
            tracks.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
            
            return tracks;
          }
        }
      } catch (backendError) {
        console.warn(`⚠️ [HymnAudioService] Erro ao buscar do backend, tentando Drive diretamente:`, backendError);
      }
      
      // Fallback: buscar diretamente do Google Drive
      console.log(`📁 [HymnAudioService] Buscando diretamente do Google Drive...`);
      
      const fileName = `hino-${hymnNumber}-`;
      
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${this.AUDIO_FOLDER_ID}'+in+parents+and+name+contains+'${fileName}'&key=${this.API_KEY}&fields=files(id,name,webContentLink)`;
      
      console.log(`[HymnAudioService] URL de busca:`, listUrl);
      
      const response = await fetch(listUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HymnAudioService] HTTP ${response.status} ao buscar áudios:`, errorText);
        return [];
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.error(`[HymnAudioService] Erro API:`, data.error);
        return [];
      }
      
      if (!data.files || data.files.length === 0) {
        console.log(`[HymnAudioService] Nenhum áudio encontrado para hino ${hymnNumber}`);
        return [];
      }
      
      console.log(`[HymnAudioService] Arquivos encontrados:`, data.files);
      
      // Filtrar arquivos .mp3 que correspondem ao padrão hino-[numero]-[instrumento].mp3
      const tracks: HymnAudioTrack[] = data.files
        .filter((f: any) => {
          const match = f.name.match(new RegExp(`^hino-${hymnNumber}-(.*)\\.mp3$`, 'i'));
          return match !== null;
        })
        .map((f: any) => {
          const match = f.name.match(new RegExp(`^hino-${hymnNumber}-(.*)\\.mp3$`, 'i'));
          const instrument = match![1]; // 'voz', 'teclado', etc.
          
          // URL de download direto do Google Drive
          const downloadUrl = `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${this.API_KEY}`;
          
          const isTeclado = instrument.toLowerCase() === 'teclado';
          
          return {
            instrument,
            fileId: f.id,
            downloadUrl,
            volume: isTeclado ? 0.4 : 1.0,
            isMuted: false,
            isLoaded: false,
            offsetMs: 0, // Sem sincronização
            displayOrder: 0,
          };
        });
      
      console.log(`✅ [HymnAudioService] ${tracks.length} áudios encontrados:`, tracks.map(t => t.instrument));
      
      return tracks;
    } catch (error) {
      console.error('[HymnAudioService] Erro ao buscar áudios:', error);
      return [];
    }
  }

  /**
   * Carrega um áudio específico usando streaming do backend
   */
  async loadTrack(track: HymnAudioTrack): Promise<Audio.Sound | null> {
    try {
      console.log(`📥 [HymnAudioService] Carregando: ${track.instrument}...`);
      
      // Usar endpoint de streaming do backend (com Range support)
      const streamUrl = `${API_URL}/hymn-audios/stream/${track.fileId}`;
      
      console.log(`🌊 [HymnAudioService] Tentando streaming via backend: ${streamUrl}`);

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: streamUrl },
          { 
            shouldPlay: false,
            volume: track.volume,
            progressUpdateIntervalMillis: 100,
          }
        );
        
        console.log(`✅ [HymnAudioService] ${track.instrument} carregado via streaming`);
        return sound;
      } catch (streamError) {
        // Fallback: Tentar URL direta do Google Drive
        console.log(`⚠️ [HymnAudioService] Streaming falhou, tentando download direto...`);
        
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${track.fileId}`;
        
        const { sound } = await Audio.Sound.createAsync(
          { uri: downloadUrl },
          { 
            shouldPlay: false,
            volume: track.volume,
            progressUpdateIntervalMillis: 100,
          }
        );
        
        console.log(`✅ [HymnAudioService] ${track.instrument} carregado via download direto`);
        return sound;
      }
    } catch (error) {
      console.error(`❌ [HymnAudioService] Erro ao carregar ${track.instrument}:`, error);
      return null;
    }
  }

  /**
   * Carrega todos os áudios
   */
  async loadAllTracks(tracks: HymnAudioTrack[]): Promise<HymnAudioTrack[]> {
    const startTime = Date.now();
    console.log(`⏱️ [TIMER] loadAllTracks iniciado para ${tracks.length} áudios`);
    
    const loadedTracks = await Promise.all(
      tracks.map(async (track) => {
        const trackStartTime = Date.now();
        try {
          const sound = await this.loadTrack(track);
          const trackEndTime = Date.now();
          console.log(`⏱️ [TIMER] Track ${track.instrument} carregado em ${trackEndTime - trackStartTime}ms`);
          return {
            ...track,
            sound: sound || undefined,
            isLoaded: sound !== null,
          };
        } catch (error) {
          console.error(`❌ [HymnAudioService] Erro ao carregar track ${track.instrument}:`, error);
          // Retornar track sem áudio carregado em caso de erro
          return {
            ...track,
            sound: undefined,
            isLoaded: false,
          };
        }
      })
    );
    
    const successCount = loadedTracks.filter(t => t.isLoaded).length;
    const totalTime = Date.now() - startTime;
    console.log(`⏱️ [TIMER] loadAllTracks concluído: ${successCount}/${tracks.length} áudios em ${totalTime}ms`);
    
    // Retornar apenas os tracks que carregaram com sucesso
    return loadedTracks.filter(t => t.isLoaded);
  }

  /**
   * Toca todos os áudios sincronizados
   * SIMPLES: Todos começam na mesma posição, sem ajustes durante reprodução
   */
  async playAll(tracks: HymnAudioTrack[]): Promise<void> {
    console.log(`▶️ [HymnAudioService] Tocando todos os áudios...`);
    
    // Filtrar apenas tracks carregados
    const loadedTracks = tracks.filter(t => t.sound && t.isLoaded);
    
    if (loadedTracks.length === 0) {
      console.error(`❌ [HymnAudioService] Nenhum áudio carregado para tocar`);
      throw new Error('Nenhum áudio disponível para reprodução');
    }
    
    console.log(`▶️ [HymnAudioService] ${loadedTracks.length}/${tracks.length} áudios prontos para tocar`);
    
    // Ajustar volume antes de tocar
    await Promise.all(
      loadedTracks.map(track => 
        track.sound!.setVolumeAsync(track.isMuted ? 0 : track.volume)
      )
    );
    
    // Tocar todos SIMULTANEAMENTE
    await Promise.all(
      loadedTracks.map(track => track.sound!.playAsync())
    );
    
    console.log(`✅ [HymnAudioService] Todos os áudios iniciados simultaneamente`);
  }

  /**
   * Pausa todos os áudios
   */
  async pauseAll(tracks: HymnAudioTrack[]): Promise<void> {
    console.log(`⏸️ [HymnAudioService] Pausando todos os áudios...`);
    
    const loadedTracks = tracks.filter(t => t.sound && t.isLoaded);
    
    await Promise.all(
      loadedTracks.map(track => track.sound!.pauseAsync())
    );
  }

  /**
   * Para todos os áudios e volta ao início
   */
  async stopAll(tracks: HymnAudioTrack[]): Promise<void> {
    console.log(`⏹️ [HymnAudioService] Parando todos os áudios...`);
    
    const stopPromises = tracks
      .filter(t => t.sound && t.isLoaded)
      .map(async (track) => {
        try {
          await track.sound!.stopAsync();
          await track.sound!.setPositionAsync(0);
        } catch (error) {
          console.error(`[HymnAudioService] Erro ao parar ${track.instrument}:`, error);
        }
      });
    
    await Promise.all(stopPromises);
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
    const firstTrack = tracks.find(t => t.sound && t.isLoaded);
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
    const firstTrack = tracks.find(t => t.sound && t.isLoaded);
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
  async seekAll(tracks: HymnAudioTrack[], positionMillis: number): Promise<void> {
    console.log(`⏩ [HymnAudioService] Buscando posição ${positionMillis}ms...`);
    
    const loadedTracks = tracks.filter(t => t.sound && t.isLoaded);
    
    // Verificar se estava tocando
    const wasPlaying = await Promise.all(
      loadedTracks.map(async (track) => {
        const status = await track.sound!.getStatusAsync();
        return status.isLoaded ? status.isPlaying : false;
      })
    );
    const shouldResume = wasPlaying.some(playing => playing);
    
    // PAUSAR TODOS primeiro
    if (shouldResume) {
      await Promise.all(
        loadedTracks.map(track => track.sound!.pauseAsync().catch(() => {}))
      );
    }
    
    // POSICIONAR TODOS na mesma posição
    await Promise.all(
      loadedTracks.map(track => track.sound!.setPositionAsync(positionMillis))
    );
    
    // RETOMAR se estava tocando
    if (shouldResume) {
      await Promise.all(
        loadedTracks
          .filter(track => !track.isMuted)
          .map(track => track.sound!.playAsync())
      );
    }
  }

  /**
   * Descarrega todos os áudios da memória
   */
  async unloadAll(tracks: HymnAudioTrack[]): Promise<void> {
    console.log(`🗑️ [HymnAudioService] Descarregando todos os áudios...`);
    
    const unloadPromises = tracks
      .filter(t => t.sound)
      .map(async (track) => {
        try {
          await track.sound!.unloadAsync();
        } catch (error) {
          console.error(`[HymnAudioService] Erro ao descarregar ${track.instrument}:`, error);
        }
      });
    
    await Promise.all(unloadPromises);
    
    console.log(`✅ [HymnAudioService] Áudios descarregados`);
  }
}

export default new HymnAudioService();
