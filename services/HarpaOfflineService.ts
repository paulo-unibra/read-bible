import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';
import { Alert } from 'react-native';

const HARPA_DIR = new Directory(Paths.document, 'harpa');
const EXTRACTED_DIR = new Directory(HARPA_DIR, 'extracted');
const HYMN_NAMES_FILE = new File(HARPA_DIR, 'hymn_names.json');

// Configurar parser XML
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

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
   * Verifica se a Harpa já foi baixada
   */
  async isHarpaDownloaded(): Promise<boolean> {
    try {
      const dirExists = EXTRACTED_DIR.exists;
      const fileExists = HYMN_NAMES_FILE.exists;
      
      console.log(`[isHarpaDownloaded] EXTRACTED_DIR.exists: ${dirExists}`);
      console.log(`[isHarpaDownloaded] HYMN_NAMES_FILE.exists: ${fileExists}`);
      
      if (!dirExists) {
        console.log('[isHarpaDownloaded] Diretório não existe');
        return false;
      }
      
      if (!fileExists) {
        console.log('[isHarpaDownloaded] Arquivo de nomes não existe');
        return false;
      }

      // Verificar se tem arquivos XML
      const files = EXTRACTED_DIR.list();
      console.log(`[isHarpaDownloaded] Arquivos encontrados: ${files.length}`);
      
      // Aceitar se tiver pelo menos 630 arquivos (98% dos hinos)
      // Isso permite alguma margem para arquivos faltando ou duplicados
      const hasEnoughFiles = files.length >= 630;
      console.log(`[isHarpaDownloaded] Tem arquivos suficientes (>=630): ${hasEnoughFiles}`);
      
      return hasEnoughFiles;
    } catch (error) {
      console.error('[isHarpaDownloaded] Erro ao verificar download:', error);
      return false;
    }
  }

  /**
   * Carrega a lista de nomes dos hinos do arquivo local
   */
  async getHymnsList(): Promise<HymnListItem[]> {
    try {
      if (this.hymnsList.length > 0) {
        return this.hymnsList;
      }

      if (HYMN_NAMES_FILE.exists) {
        const content = await HYMN_NAMES_FILE.text();
        this.hymnsList = JSON.parse(content);
        return this.hymnsList;
      }

      return [];
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

      // Descompactar ZIP do bundle
      await this.extractZipFromBundle(onProgress);

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
   * Extrai o ZIP do bundle do app
   */
  private async extractZipFromBundle(onProgress?: (progress: number) => void): Promise<void> {
    console.log('[HarpaOffline] Carregando ZIP do bundle...');

    // Carregar o ZIP do bundle
    const zipAsset = Asset.fromModule(require('../assets/harpa/hc_xml.zip'));
    await zipAsset.downloadAsync();

    if (!zipAsset.localUri) {
      throw new Error('Não foi possível carregar o arquivo ZIP');
    }

    if (onProgress) onProgress(10);

    // Ler o arquivo ZIP como ArrayBuffer
    const response = await fetch(zipAsset.localUri);
    const arrayBuffer = await response.arrayBuffer();
    
    if (onProgress) onProgress(20);

    // Descompactar com JSZip
    const zip = new JSZip();
    const zipData = await zip.loadAsync(arrayBuffer);

    const files = Object.keys(zipData.files);
    console.log(`[HarpaOffline] Encontrados ${files.length} arquivos no ZIP`);

    const hymnsList: HymnListItem[] = [];
    let processed = 0;

    // Extrair cada arquivo
    for (const fileName of files) {
      const file = zipData.files[fileName];
      
      if (file.dir || !fileName.endsWith('.xml')) {
        continue;
      }

      try {
        // Extrair número e título do nome do arquivo
        // Formato: "HC 001 Chuvas De Graça (Harpa Cristã).xml"
        const match = fileName.match(/HC\s+(\d+)\s+(.+?)\s+\(Harpa Cristã\)\.xml/);
        
        if (match) {
          const number = parseInt(match[1]);
          const title = match[2].trim();
          
          // Ler conteúdo do XML
          const content = await file.async('text');
          
          // Salvar arquivo com número como nome
          const destFile = new File(EXTRACTED_DIR, `${number}.xml`);
          await destFile.write(content);
          
          // Adicionar à lista
          hymnsList.push({
            number,
            title,
            fileName: fileName,
          });
        }
        
        processed++;
        
        // Atualizar progresso (20% a 90%)
        const progress = Math.floor(20 + (processed / files.length) * 70);
        this.downloadProgress = progress;
        if (onProgress) {
          onProgress(progress);
        }
      } catch (error) {
        console.warn(`[HarpaOffline] Erro ao extrair arquivo ${fileName}:`, error);
      }
    }

    // Ordenar por número
    hymnsList.sort((a, b) => a.number - b.number);

    // Salvar lista de nomes
    await HYMN_NAMES_FILE.write(JSON.stringify(hymnsList));
    this.hymnsList = hymnsList;

    if (onProgress) onProgress(95);

    console.log(`[HarpaOffline] ✅ ${hymnsList.length} hinos extraídos com sucesso`);
  }

  /**
   * Busca um hino específico pelo número
   */
  async getHymnByNumber(hymnNumber: number): Promise<HymnData | null> {
    console.log(`🔍 [HarpaOffline] Buscando hino ${hymnNumber}...`);
    
    // Verificar cache
    if (this.hymnsCache.has(hymnNumber)) {
      console.log(`✅ [HarpaOffline] Hino ${hymnNumber} encontrado no cache`);
      return this.hymnsCache.get(hymnNumber)!;
    }

    // Verificar se a Harpa foi baixada
    const isDownloaded = await this.isHarpaDownloaded();
    console.log(`📦 [HarpaOffline] Harpa baixada: ${isDownloaded}`);
    
    if (!isDownloaded) {
      // Mostrar detalhes do diagnóstico
      const dirExists = EXTRACTED_DIR.exists;
      const fileExists = HYMN_NAMES_FILE.exists;
      let fileCount = 0;
      
      if (dirExists) {
        try {
          const files = EXTRACTED_DIR.list();
          fileCount = files.length;
        } catch (e) {
          console.error('Erro ao listar arquivos:', e);
        }
      }
      
      // Obter caminho de forma segura
      let dirPath = 'N/A';
      try {
        dirPath = EXTRACTED_DIR.path || EXTRACTED_DIR.uri || 'undefined';
      } catch (e) {
        dirPath = 'erro ao obter path';
      }
      
      Alert.alert(
        'Harpa não baixada',
        `A Harpa Cristã ainda não foi baixada.\n\n` +
        `Diagnóstico:\n` +
        `• Diretório existe: ${dirExists ? 'Sim' : 'Não'}\n` +
        `• Caminho: ${dirPath}\n` +
        `• Arquivo de nomes: ${fileExists ? 'Sim' : 'Não'}\n` +
        `• Arquivos XML: ${fileCount}\n` +
        `• Necessário: 630+ arquivos\n\n` +
        `Por favor, faça o download primeiro na tela da Harpa.`
      );
      return null;
    }

    try {
      // Debug: listar todos os arquivos no diretório
      const dirPath = EXTRACTED_DIR.path;
      const dirExists = EXTRACTED_DIR.exists;
      
      console.log(`📂 [HarpaOffline] EXTRACTED_DIR.path: ${dirPath}`);
      console.log(`📂 [HarpaOffline] EXTRACTED_DIR.exists: ${dirExists}`);
      
      let filesInfo = '';
      if (dirExists) {
        const files = EXTRACTED_DIR.list();
        filesInfo = `Total de arquivos: ${files.length}`;
        
        if (files.length > 0 && files.length <= 10) {
          filesInfo += `\n\nPrimeiros arquivos:\n${files.slice(0, 10).join('\n')}`;
        }
      } else {
        filesInfo = 'Diretório não existe!';
      }

      const xmlFile = new File(EXTRACTED_DIR, `${hymnNumber}.xml`);
      const filePath = xmlFile.path;
      const fileExists = xmlFile.exists;
      
      console.log(`📁 [HarpaOffline] Verificando arquivo: ${filePath}`);
      console.log(`📁 [HarpaOffline] Arquivo existe: ${fileExists}`);

      if (!fileExists) {
        Alert.alert(
          `Debug - Hino ${hymnNumber}`,
          `Arquivo não encontrado!\n\n` +
          `Caminho: ${filePath}\n\n` +
          `Diretório existe: ${dirExists}\n` +
          `${filesInfo}`
        );
        return null;
      }

      console.log(`✅ [HarpaOffline] Arquivo encontrado, lendo conteúdo...`);
      
      // Ler arquivo XML
      const xmlContent = await xmlFile.text();
      console.log(`📄 [HarpaOffline] Conteúdo XML lido: ${xmlContent.length} caracteres`);

      // Parse do XML
      const result = xmlParser.parse(xmlContent);

      // Extrair dados do XML
      const hymnData = this.parseHymnXML(result, hymnNumber);

      // Armazenar no cache
      if (hymnData) {
        this.hymnsCache.set(hymnNumber, hymnData);
        console.log(`✅ [HarpaOffline] Hino ${hymnNumber} carregado e armazenado no cache`);
      } else {
        Alert.alert(
          'Erro ao parsear',
          `Falha ao processar o XML do hino ${hymnNumber}`
        );
      }

      return hymnData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert(
        `Erro - Hino ${hymnNumber}`,
        `Erro ao ler hino:\n\n${errorMessage}\n\nDiretório: ${EXTRACTED_DIR.path}\n\nVerifique se a Harpa foi baixada corretamente.`
      );
      console.error(`❌ [HarpaOffline] Erro ao ler hino ${hymnNumber}:`, error);
      return null;
    }
  }

  /**
   * Parse do XML do hino
   */
  private parseHymnXML(xml: any, hymnNumber: number): HymnData | null {
    try {
      console.log(`📄 [HarpaOffline] Parsing XML do hino ${hymnNumber}...`);
      
      const song = xml.song;
      
      if (!song) {
        console.error('❌ [HarpaOffline] Elemento <song> não encontrado no XML');
        return null;
      }
      
      // Extrair dados do properties
      const properties = song.properties || {};
      const titles = properties.titles || {};
      const authors = properties.authors || {};
      
      const hymnData: HymnData = {
        number: hymnNumber,
        title: titles.title || `Hino ${hymnNumber}`,
        author: authors.author || 'Autor Desconhecido',
        copyright: properties.copyright || '',
        verses: [],
      };

      // Parse das estrofes
      if (song.lyrics && song.lyrics.verse) {
        const verses = Array.isArray(song.lyrics.verse) ? song.lyrics.verse : [song.lyrics.verse];
        
        for (const verse of verses) {
          const verseName = verse['@_name'] || '';
          const verseType = verseName.toLowerCase().includes('c') && !verseName.toLowerCase().includes('v')
            ? 'chorus' 
            : 'verse';

          // Parse das linhas
          const lines: string[] = [];
          
          if (verse.lines) {
            // Verificar se há texto concatenado
            if (verse.lines['#text']) {
              const fullText = verse.lines['#text'].trim();
              
              // Verificar se há elementos <br> indicando quebras de linha
              const brCount = Array.isArray(verse.lines.br) ? verse.lines.br.length : 0;
              
              if (brCount > 0) {
                // Dividir o texto pela quantidade de <br>
                // Como os <br> estão vazios, precisamos dividir o texto manualmente
                // Vamos tentar dividir em partes aproximadamente iguais
                const charsPerLine = Math.ceil(fullText.length / (brCount + 1));
                
                // Estratégia: dividir por palavras para manter integridade
                const words = fullText.split(/\s+/);
                const wordsPerLine = Math.ceil(words.length / (brCount + 1));
                
                for (let i = 0; i < brCount + 1; i++) {
                  const start = i * wordsPerLine;
                  const end = Math.min((i + 1) * wordsPerLine, words.length);
                  const lineText = words.slice(start, end).join(' ').trim();
                  if (lineText) {
                    lines.push(lineText);
                  }
                }
              } else {
                // Se não há <br>, usar o texto completo como uma linha
                lines.push(fullText);
              }
            } else if (verse.lines.line) {
              // Formato alternativo com elementos <line>
              const lineElements = Array.isArray(verse.lines.line) ? verse.lines.line : [verse.lines.line];
              
              for (const line of lineElements) {
                if (typeof line === 'string') {
                  lines.push(line.trim());
                } else if (line['#text']) {
                  lines.push(line['#text'].trim());
                }
              }
            }
          }

          hymnData.verses.push({
            name: verseName,
            type: verseType,
            lines,
          });
        }
      } else {
        console.error('❌ [HarpaOffline] Elemento <lyrics> ou <verse> não encontrado no XML');
      }

      console.log(`✅ [HarpaOffline] Hino ${hymnNumber} parseado com ${hymnData.verses.length} estrofes`);
      return hymnData;
    } catch (error) {
      console.error('❌ [HarpaOffline] Erro ao fazer parse do XML:', error);
      return null;
    }
  }

  /**
   * Lista todos os hinos disponíveis (apenas números)
   */
  async getAllHymnNumbers(): Promise<number[]> {
    const list = await this.getHymnsList();
    return list.map(h => h.number);
  }

  /**
   * Remove todos os dados da Harpa (para re-download)
   */
  async clearHarpaData(): Promise<void> {
    try {
      if (HARPA_DIR.exists) {
        HARPA_DIR.delete();
      }
      this.hymnsCache.clear();
      console.log('[HarpaOffline] Dados da Harpa removidos');
    } catch (error) {
      console.error('[HarpaOffline] Erro ao remover dados:', error);
    }
  }
}

export default new HarpaOfflineService();
