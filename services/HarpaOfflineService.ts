import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { Alert } from 'react-native';
import DatabaseService from './DatabaseService';

const HARPA_DIR = new Directory(Paths.document, 'harpa');
const EXTRACTED_DIR = new Directory(HARPA_DIR, 'extracted');
const HYMN_NAMES_FILE = new File(HARPA_DIR, 'hymn_names.json');

export interface HymnData {
  number: number;
  title: string;
  author: string;
  copyright: string;
  verses: {
    name: string;
    type: 'verse' | 'chorus';
    lines: string[];
  }[];
}

export interface HymnListItem {
  number: number;
  title: string;
  fileName: string;
}

class HarpaOfflineService {
  private isDownloading = false;
  private downloadProgress = 0;
  private hymnsCache: Map<number, HymnData> = new Map();
  private hymnsList: HymnListItem[] = [];

  /**
   * Verifica se a Harpa já foi baixada e está disponível no banco de dados
   */
  async isHarpaDownloaded(): Promise<boolean> {
    try {
      // Verificar quantos hinos existem no banco de dados
      const count = await DatabaseService.getHymnsDatabaseCount();
      console.log(`[isHarpaDownloaded] Hinos no banco de dados: ${count}`);
      
      // Considerar baixado se tiver pelo menos 630 hinos (98% dos 640)
      const isDownloaded = count >= 630;
      console.log(`[isHarpaDownloaded] Harpa baixada: ${isDownloaded}`);
      
      return isDownloaded;
    } catch (error) {
      console.error('[isHarpaDownloaded] Erro ao verificar download:', error);
      return false;
    }
  }

  /**
   * Carrega a lista de nomes dos hinos do banco de dados
   */
  async getHymnsList(): Promise<HymnListItem[]> {
    try {
      if (this.hymnsList.length > 0) {
        return this.hymnsList;
      }

      // Buscar todos os hinos do banco de dados
      const hymns = await DatabaseService.getAllHymnsMetadata();
      
      this.hymnsList = hymns.map(h => ({
        number: h.number,
        title: h.title,
        fileName: `${h.number}.json`
      }));
      
      console.log(`[HarpaOffline] ${this.hymnsList.length} hinos carregados do banco`);
      return this.hymnsList;
    } catch (error) {
      console.error('[HarpaOffline] Erro ao carregar lista de hinos:', error);
      return [];
    }
  }

  /**
   * Retorna o progresso do download (0-100)
   */
  getDownloadProgress(): number {
    return this.downloadProgress;
  }

  /**
   * Verifica se está fazendo download no momento
   */
  isDownloadingNow(): boolean {
    return this.isDownloading;
  }

  /**
   * Faz o download e extração da Harpa completa
   */
  async downloadHarpa(
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isDownloading) {
      return { success: false, error: 'Download já em andamento' };
    }

    try {
      this.isDownloading = true;
      this.downloadProgress = 0;

      console.log('[HarpaOffline] Iniciando extração da Harpa Cristã...');

      // Criar diretórios se não existirem
      if (!HARPA_DIR.exists) {
        HARPA_DIR.create();
      }

      if (!EXTRACTED_DIR.exists) {
        EXTRACTED_DIR.create();
      }

      if (onProgress) onProgress(5);

      // Carregar JSON do bundle
      await this.loadJsonFromBundle(onProgress);

      this.downloadProgress = 100;
      if (onProgress) {
        onProgress(100);
      }

      console.log('[HarpaOffline] ✅ Harpa Cristã extraída com sucesso!');

      return { success: true };
    } catch (error) {
      console.error('[HarpaOffline] Erro ao extrair Harpa:', error);
      this.isDownloading = false;
      this.downloadProgress = 0;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Carrega os hinos do arquivo JSON do bundle
   */
  private async loadJsonFromBundle(onProgress?: (progress: number) => void): Promise<void> {
    console.log('[HarpaOffline] Carregando JSON do bundle...');

    try {
      if (onProgress) onProgress(10);

      // Carregar o JSON diretamente (já vem parseado pelo Metro bundler)
      const hymnsData = require('../assets/harpa/hc_json.json');

      console.log(`[HarpaOffline] Encontrados ${hymnsData.length} hinos no JSON`);

      if (onProgress) onProgress(20);

      const hymnsToSave: HymnData[] = [];

      // Processar cada hino do JSON
      for (let i = 0; i < hymnsData.length; i++) {
        const hymnJson = hymnsData[i];
        
        try {
          // Converter formato JSON para formato do app
          const hymnData: HymnData = {
            number: hymnJson.number,
            title: hymnJson.title,
            author: hymnJson.author || '',
            copyright: 'Harpa Cristã',
            verses: hymnJson.verses.map((verse: any) => ({
              name: verse.chorus ? 'Coro' : `Estrofe ${verse.sequence}`,
              type: verse.chorus ? 'chorus' : 'verse',
              lines: verse.lyrics.split('\n').filter((line: string) => line.trim())
            }))
          };
          
          hymnsToSave.push(hymnData);
          
          // Salvar em lotes de 50 hinos
          if (hymnsToSave.length >= 50) {
            console.log(`[HarpaOffline] 💾 Salvando lote de ${hymnsToSave.length} hinos no banco...`);
            await DatabaseService.saveHymnsBatch([...hymnsToSave]);
            hymnsToSave.length = 0;
          }
        } catch (error) {
          console.warn(`[HarpaOffline] Erro ao processar hino ${hymnJson.number}:`, error);
        }
        
        // Atualizar progresso (20% a 90%)
        const progress = Math.floor(20 + (i / hymnsData.length) * 70);
        this.downloadProgress = progress;
        if (onProgress) {
          onProgress(progress);
        }
      }

      // Salvar hinos restantes
      if (hymnsToSave.length > 0) {
        console.log(`[HarpaOffline] 💾 Salvando lote final de ${hymnsToSave.length} hinos no banco...`);
        await DatabaseService.saveHymnsBatch(hymnsToSave);
      }

      // Verificar quantos hinos foram salvos no banco
      const count = await DatabaseService.getHymnsDatabaseCount();
      console.log(`[HarpaOffline] ✅ Total de ${count} hinos salvos no banco de dados`);

      if (count === 0) {
        throw new Error('Nenhum hino foi salvo no banco de dados');
      }

      if (onProgress) onProgress(95);

      console.log(`[HarpaOffline] ✅ Download e conversão concluídos com sucesso!`);
    } catch (error) {
      console.error('[HarpaOffline] Erro ao processar JSON:', error);
      throw error;
    }
  }

  /**
   * Busca um hino específico pelo número
   */
  async getHymnByNumber(hymnNumber: number): Promise<HymnData | null> {
    console.log(`🔍 [HarpaOffline] Buscando hino ${hymnNumber}...`);
    
    // Verificar cache em memória
    if (this.hymnsCache.has(hymnNumber)) {
      console.log(`✅ [HarpaOffline] Hino ${hymnNumber} encontrado no cache em memória`);
      return this.hymnsCache.get(hymnNumber)!;
    }

    // Buscar no banco de dados
    const hymnFromDb = await DatabaseService.getHymnFromDatabase(hymnNumber);
    
    if (hymnFromDb) {
      console.log(`✅ [HarpaOffline] Hino ${hymnNumber} encontrado no banco de dados`);
      const hymnData: HymnData = {
        number: hymnFromDb.number,
        title: hymnFromDb.title,
        author: hymnFromDb.author,
        copyright: hymnFromDb.copyright,
        verses: hymnFromDb.verses
      };
      // Armazenar no cache em memória
      this.hymnsCache.set(hymnNumber, hymnData);
      return hymnData;
    }

    // Hino não encontrado no banco
    console.warn(`⚠️ [HarpaOffline] Hino ${hymnNumber} não encontrado no banco`);
    
    // Verificar se a Harpa foi baixada
    const count = await DatabaseService.getHymnsDatabaseCount();
    
    if (count === 0) {
      Alert.alert(
        'Harpa não baixada',
        'A Harpa Cristã ainda não foi baixada.\n\n' +
        'Por favor, faça o download primeiro na tela da Harpa.'
      );
      return null;
    }
    
    // Hino específico não encontrado
    Alert.alert(
      `Hino ${hymnNumber}`,
      `Hino não encontrado no banco de dados.\n\n` +
      `Total de hinos disponíveis: ${count}`
    );
    return null;
  }

  /**
   * Lista todos os hinos disponíveis (apenas números)
   */
  async getAllHymnNumbers(): Promise<number[]> {
    const list = await this.getHymnsList();
    return list.map(h => h.number);
  }

  /**
   * Busca por texto no conteúdo dos hinos
   * Retorna lista de hinos com trechos encontrados
   * AGORA USA O BANCO DE DADOS - MUITO MAIS RÁPIDO!
   */
  async searchInContent(query: string): Promise<Array<{ number: number; title: string; snippet: string }>> {
    try {
      console.log(`🔍 [HarpaOffline] Buscando "${query}" no banco de dados...`);
      
      // Verificar se os hinos foram carregados
      const count = await DatabaseService.getHymnsDatabaseCount();
      console.log(`📊 [HarpaOffline] Hinos no banco: ${count}`);
      
      if (count === 0) {
        console.warn('⚠️ [HarpaOffline] Banco de dados vazio! Hinos não foram carregados.');
        console.warn('💡 [HarpaOffline] É necessário baixar a Harpa Cristã primeiro.');
        return [];
      }
      
      // Buscar direto no banco (RÁPIDO)
      const results = await DatabaseService.searchHymnsInDatabase(query, 20);
      
      console.log(`✅ [HarpaOffline] Encontrados ${results.length} resultados no banco`);
      return results;
      
    } catch (error) {
      console.warn(`⚠️ [HarpaOffline] Erro na busca no banco, usando método antigo:`, error);
      
      // Fallback: busca manual nos dados do banco
      return this.searchInContentLegacy(query);
    }
  }

  /**
   * Método antigo de busca (fallback)
   */
  private async searchInContentLegacy(query: string): Promise<Array<{ number: number; title: string; snippet: string }>> {
    try {
      const lowerQuery = query.toLowerCase();
      const results: Array<{ number: number; title: string; snippet: string }> = [];
      const hymnsList = await this.getHymnsList();
      
      // Limitar busca para evitar travamento da UI (buscar apenas nos primeiros 5 hinos)
      const maxHymnsToSearch = Math.min(hymnsList.length, 5);
      
      for (let i = 0; i < maxHymnsToSearch; i++) {
        const hymnItem = hymnsList[i];
        
        try {
          const hymn = await this.getHymnByNumber(hymnItem.number);
          
          if (!hymn) continue;
          
          // Buscar em todas as estrofes
          for (const verse of hymn.verses) {
            const verseText = verse.lines.join(' ').toLowerCase();
            
            if (verseText.includes(lowerQuery)) {
              // Encontrar posição do match
              const matchIndex = verseText.indexOf(lowerQuery);
              
              // Criar snippet com contexto (50 caracteres antes e depois)
              const start = Math.max(0, matchIndex - 50);
              const end = Math.min(verseText.length, matchIndex + query.length + 50);
              
              let snippet = verseText.substring(start, end);
              
              // Adicionar reticências se necessário
              if (start > 0) snippet = '...' + snippet;
              if (end < verseText.length) snippet = snippet + '...';
              
              // Capitalizar primeira letra
              snippet = snippet.charAt(0).toUpperCase() + snippet.slice(1);
              
              results.push({
                number: hymn.number,
                title: hymn.title,
                snippet: snippet,
              });
              
              break; // Apenas um resultado por hino
            }
          }
          
          // Limitar resultados
          if (results.length >= 50) break;
        } catch (error) {
          console.error(`Erro ao buscar no hino ${hymnItem.number}:`, error);
          continue;
        }
      }
      
      return results;
    } catch (error) {
      console.error('[HarpaOffline] Erro ao buscar no conteúdo:', error);
      return [];
    }
  }

  /**
   * Remove todos os dados da Harpa (para re-download)
   */
  async clearHarpaData(): Promise<void> {
    try {
      // Limpar banco de dados
      await DatabaseService.clearAllHymns();
      console.log('[HarpaOffline] ✅ Hinos removidos do banco de dados');
      
      // Limpar cache em memória
      this.hymnsCache.clear();
      this.hymnsList = [];
      
      console.log('[HarpaOffline] ✅ Dados da Harpa removidos completamente');
    } catch (error) {
      console.error('[HarpaOffline] ❌ Erro ao remover dados:', error);
      throw error;
    }
  }
}

export default new HarpaOfflineService();
