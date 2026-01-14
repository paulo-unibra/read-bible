import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';

const API_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3333';

export interface CacheStatus {
  isCached: boolean;
  localPath?: string;
  fileSize?: number;
}

export interface DownloadProgress {
  trackIndex: number;
  instrument: string;
  progress: number; // 0 a 1
  downloadedBytes: number;
  totalBytes: number;
}

class HymnCacheService {
  private getCacheDir(): string {
    return `${FileSystem.documentDirectory!}hymn-audios/`;
  }
  
  /**
   * Inicializa o diretório de cache
   */
  async initialize(): Promise<void> {
    try {
      const cacheDir = this.getCacheDir();
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        console.log('📁 [HymnCache] Criando diretório de cache...');
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
        console.log('✅ [HymnCache] Diretório criado:', cacheDir);
      }
    } catch (error) {
      console.error('❌ [HymnCache] Erro ao criar diretório:', error);
      throw error;
    }
  }

  /**
   * Gera o caminho local para um arquivo de áudio
   */
  getLocalPath(hymnNumber: number, instrument: string): string {
    // Sanitizar nome do instrumento (remover caracteres especiais)
    const sanitized = instrument.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${this.getCacheDir()}hino-${hymnNumber}-${sanitized}.mp3`;
  }

  /**
   * Verifica se um arquivo está em cache
   */
  async isCached(hymnNumber: number, instrument: string): Promise<CacheStatus> {
    try {
      const localPath = this.getLocalPath(hymnNumber, instrument);
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      
      if (fileInfo.exists) {
        return {
          isCached: true,
          localPath,
          fileSize: fileInfo.size || 0,
        };
      }
      
      return { isCached: false };
    } catch (error) {
      console.error(`❌ [HymnCache] Erro ao verificar cache:`, error);
      return { isCached: false };
    }
  }

  /**
   * Verifica status de cache de múltiplas faixas
   */
  async checkMultipleTracks(hymnNumber: number, instruments: string[]): Promise<Map<string, CacheStatus>> {
    const results = new Map<string, CacheStatus>();
    
    await Promise.all(
      instruments.map(async (instrument) => {
        const status = await this.isCached(hymnNumber, instrument);
        results.set(instrument, status);
      })
    );
    
    return results;
  }

  /**
   * Baixa um arquivo de áudio para o cache local
   */
  async downloadTrack(
    hymnNumber: number,
    instrument: string,
    fileId: string,
    onProgress?: (progress: DownloadProgress, trackIndex: number) => void,
    trackIndex: number = 0
  ): Promise<string> {
    try {
      await this.initialize();
      
      const localPath = this.getLocalPath(hymnNumber, instrument);
      
      // Verificar se já existe
      const cached = await this.isCached(hymnNumber, instrument);
      if (cached.isCached && cached.localPath) {
        console.log(`✅ [HymnCache] Arquivo já existe: ${instrument}`);
        return cached.localPath;
      }
      
      console.log(`📥 [HymnCache] Baixando ${instrument}...`);
      
      // URL de streaming do backend
      const downloadUrl = `${API_URL}/hymn-audios/stream/${fileId}`;
      
      // Criar callback de progresso
      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        localPath,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          
          if (onProgress) {
            onProgress({
              trackIndex,
              instrument,
              progress,
              downloadedBytes: downloadProgress.totalBytesWritten,
              totalBytes: downloadProgress.totalBytesExpectedToWrite,
            }, trackIndex);
          }
        }
      );
      
      const result = await downloadResumable.downloadAsync();
      
      if (result && result.uri) {
        console.log(`✅ [HymnCache] ${instrument} baixado: ${result.uri}`);
        return result.uri;
      }
      
      throw new Error('Download falhou');
    } catch (error) {
      console.error(`❌ [HymnCache] Erro ao baixar ${instrument}:`, error);
      
      // Tentar limpar arquivo parcial
      try {
        const localPath = this.getLocalPath(hymnNumber, instrument);
        const fileInfo = await FileSystem.getInfoAsync(localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(localPath);
        }
      } catch {
        // Ignorar erro de limpeza
      }
      
      throw error;
    }
  }

  /**
   * Baixa múltiplas faixas com progresso agregado
   */
  async downloadAllTracks(
    hymnNumber: number,
    tracks: { instrument: string; fileId: string }[],
    onProgress?: (overall: number, trackProgress: DownloadProgress) => void
  ): Promise<Map<string, string>> {
    await this.initialize();
    
    const results = new Map<string, string>();
    const trackProgress = new Map<number, number>();
    
    // Callback de progresso que calcula média geral
    const progressCallback = (progress: DownloadProgress, trackIndex: number) => {
      trackProgress.set(trackIndex, progress.progress);
      
      // Calcular progresso geral
      const totalProgress = Array.from(trackProgress.values()).reduce((sum, p) => sum + p, 0) / tracks.length;
      
      if (onProgress) {
        onProgress(totalProgress, progress);
      }
    };
    
    // Baixar todas as faixas em paralelo
    const downloads = tracks.map((track, index) =>
      this.downloadTrack(hymnNumber, track.instrument, track.fileId, progressCallback, index)
        .then(localPath => {
          results.set(track.instrument, localPath);
        })
        .catch(error => {
          console.error(`❌ [HymnCache] Falha ao baixar ${track.instrument}:`, error);
          throw error;
        })
    );
    
    await Promise.all(downloads);
    
    return results;
  }

  /**
   * Remove um arquivo do cache
   */
  async removeFromCache(hymnNumber: number, instrument: string): Promise<void> {
    try {
      const localPath = this.getLocalPath(hymnNumber, instrument);
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localPath);
        console.log(`🗑️ [HymnCache] Removido: ${instrument}`);
      }
    } catch (error) {
      console.error(`❌ [HymnCache] Erro ao remover ${instrument}:`, error);
      throw error;
    }
  }

  /**
   * Remove todos os arquivos de um hino
   */
  async removeHymnFromCache(hymnNumber: number): Promise<void> {
    try {
      const cacheDir = this.getCacheDir();
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) return;
      
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      const hymnFiles = files.filter(file => file.startsWith(`hino-${hymnNumber}-`));
      
      await Promise.all(
        hymnFiles.map(file => 
          FileSystem.deleteAsync(`${cacheDir}${file}`)
        )
      );
      
      console.log(`🗑️ [HymnCache] Removidos ${hymnFiles.length} arquivos do hino ${hymnNumber}`);
    } catch (error) {
      console.error(`❌ [HymnCache] Erro ao remover hino ${hymnNumber}:`, error);
      throw error;
    }
  }

  /**
   * Calcula o tamanho total do cache
   */
  async getCacheSize(): Promise<number> {
    try {
      const cacheDir = this.getCacheDir();
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) return 0;
      
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = `${cacheDir}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists && fileInfo.size) {
          totalSize += fileInfo.size;
        }
      }
      
      return totalSize;
    } catch (error) {
      console.error('❌ [HymnCache] Erro ao calcular tamanho:', error);
      return 0;
    }
  }

  /**
   * Limpa todo o cache
   */
  async clearAllCache(): Promise<void> {
    try {
      const cacheDir = this.getCacheDir();
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(cacheDir, { idempotent: true });
        await this.initialize();
        console.log('🗑️ [HymnCache] Cache limpo completamente');
      }
    } catch (error) {
      console.error('❌ [HymnCache] Erro ao limpar cache:', error);
      throw error;
    }
  }

  /**
   * Formata tamanho de arquivo em formato legível
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}

export default new HymnCacheService();
