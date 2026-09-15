export interface Hymn {
  id: string;
  number: number;
  title: string;
  copyright: string;
  author: string;
  verses: HymnVerse[];
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:1999';

export interface HymnListItem {
  number: number;
  title: string;
  fileId?: string; // ID do arquivo no Drive (se já foi encontrado)
}

export interface HymnVerse {
  name: string; // v1, v2, c1 (chorus), etc
  type: 'verse' | 'chorus';
  lines: string[];
}

class HarpaService {
  private hymnsCache: Hymn[] | null = null;
  private hymnDetailsCache: Map<number, Hymn> = new Map(); // Cache de hinos já baixados

  /**
   * Retorna lista completa de todos os 640 hinos (só com número e título)
   */
  getAllHymnsList(): HymnListItem[] {
    const hymns: HymnListItem[] = [];
    
    // Lista hardcoded dos 640 hinos da Harpa Cristã
    // Por enquanto, vou criar uma lista genérica - você pode atualizar com os títulos reais depois
    for (let i = 1; i <= 640; i++) {
      hymns.push({
        number: i,
        title: `Hino ${i}`, // Título genérico - será atualizado quando baixar
      });
    }
    
    return hymns;
  }

  /**
   * Busca um hino específico no Drive (igual ao AudioService)
   */
  private async searchHymnInDrive(hymnNumber: number): Promise<{ id: string; name: string } | null> {
    try {
      const numberStr = hymnNumber.toString().padStart(3, '0');
      const fileName = `HC ${numberStr}`; // Ex: "HC 001"
      
      const listUrl = `${API_URL}/drive/harpa/${hymnNumber}/metadata`;
      
      if (hymnNumber === 1) {
        console.log('[HarpaService] URL de busca (hino 1):', listUrl);
      }
      
      const response = await fetch(listUrl);
      
      if (hymnNumber === 1) {
        console.log('[HarpaService] Status HTTP:', response.status);
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HarpaService] HTTP ${response.status} ao buscar hino ${hymnNumber}:`, errorText);
        return null;
      }
      
      const data = await response.json();
      
      if (hymnNumber === 1) {
        console.log('[HarpaService] Resposta completa (hino 1):', JSON.stringify(data, null, 2));
      }
      
      if (!data.success) {
        console.error(`[HarpaService] Erro API hino ${hymnNumber}:`, data.message);
        return null;
      }
      
      if (!data.file) {
        if (hymnNumber === 1) {
          console.log('[HarpaService] Nenhum arquivo retornado para hino 1');
        }
        return null;
      }
      
      if (hymnNumber === 1) {
        console.log(`[HarpaService] Arquivo encontrado para hino 1:`, data.file);
      }
      
      return data.file;
    } catch (error) {
      console.error(`[HarpaService] Exceção ao buscar hino ${hymnNumber}:`, error);
      return null;
    }
  }

  /**
   * Lista todos os hinos disponíveis (HC 001 a HC 640)
   */
  async listHymnsFromDrive(): Promise<{ id: string; name: string; number: number }[]> {
    const hymns: { id: string; name: string; number: number }[] = [];
    
    console.log('[HarpaService] Iniciando busca de hinos...');
    
    // Buscar apenas os primeiros 50 hinos para ser mais rápido
    const maxHymns = 50;
    let foundCount = 0;
    
    for (let i = 1; i <= maxHymns; i++) {
      const file = await this.searchHymnInDrive(i);
      
      if (file) {
        hymns.push({
          id: file.id,
          name: file.name,
          number: i,
        });
        foundCount++;
        
        if (i <= 5) {
          console.log(`[HarpaService] ✓ Hino ${i}: ${file.name}`);
        }
      }
      
      // A cada 10 hinos, dar feedback
      if (i % 10 === 0) {
        console.log(`[HarpaService] Processados ${i}/${maxHymns}, encontrados: ${foundCount}`);
      }
    }
    
    console.log(`[HarpaService] ✓ Total encontrado: ${foundCount}/${maxHymns} hinos`);
    
    if (foundCount === 0) {
      throw new Error('Nenhum hino encontrado. Verifique se a pasta está pública com permissão "Qualquer pessoa com o link pode visualizar"');
    }
    
    return hymns;
  }

  /**
   * Baixa e parseia um arquivo XML de hino do Google Drive
   */
  async downloadHymn(fileId: string): Promise<string> {
    try {
      console.log(`[HarpaService] Baixando arquivo ID: ${fileId}`);
      
      // Método 1: URL direta do Google Drive com confirm=t para bypass do aviso de vírus
      try {
        const directUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
        const response = await fetch(directUrl);
        
        if (response.ok) {
          const xmlContent = await response.text();
          
          if (xmlContent.includes('<?xml') || xmlContent.includes('<song')) {
            console.log(`[HarpaService] ✓ Arquivo baixado com sucesso (${xmlContent.length} bytes)`);
            return xmlContent;
          } else {
            console.log(`[HarpaService] Resposta não é XML válido, tentando método alternativo...`);
          }
        }
      } catch (e) {
        console.log(`[HarpaService] Método direto falhou:`, e);
      }
      
      // Método 2: URL alternativa com confirm=t
      try {
        const alternativeUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
        const response = await fetch(alternativeUrl);
        
        if (response.ok) {
          const xmlContent = await response.text();
          
          if (xmlContent.includes('<?xml') || xmlContent.includes('<song')) {
            console.log(`[HarpaService] ✓ Arquivo baixado via método alternativo (${xmlContent.length} bytes)`);
            return xmlContent;
          }
        }
      } catch (e) {
        console.log(`[HarpaService] Método alternativo falhou:`, e);
      }
      
      // Método 3: Buscar metadados e tentar webContentLink
      try {
        const metadataUrl = `${API_URL}/drive/harpa/${fileId}/download`;
        const metadataResponse = await fetch(metadataUrl);
        
        if (metadataResponse.ok) {
          const xmlContent = await metadataResponse.text();
          if (xmlContent.includes('<?xml') || xmlContent.includes('<song')) {
            console.log(`[HarpaService] ✓ Arquivo baixado via backend (${xmlContent.length} bytes)`);
            return xmlContent;
          }
        }
      } catch (e) {
        console.log(`[HarpaService] Busca de metadados falhou:`, e);
      }
      
      throw new Error(`Não foi possível baixar o arquivo. Verifique se a pasta está compartilhada como "Qualquer pessoa com o link".`);
      
    } catch (error) {
      console.error('[HarpaService] Erro ao baixar hino:', error);
      throw error;
    }
  }

  /**
   * Parseia o XML do formato OpenLyrics para objeto Hymn
   */
  parseHymnXML(xml: string, fileId: string, fileName: string): Hymn {
    try {
      // Extrair número do hino do nome do arquivo (ex: "HC 001 Chuvas De Graça.xml" -> 1)
      const numberMatch = fileName.match(/HC\s*(\d+)/i);
      const number = numberMatch ? parseInt(numberMatch[1], 10) : 0;

      // Extrair título
      const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(/^HC\d+\s*-\s*/, '').trim() : 'Sem título';

      // Extrair copyright
      const copyrightMatch = xml.match(/<copyright>([^<]+)<\/copyright>/);
      const copyright = copyrightMatch ? copyrightMatch[1] : '';

      // Extrair autor
      const authorMatch = xml.match(/<author>([^<]+)<\/author>/);
      const author = authorMatch ? authorMatch[1] : 'Desconhecido';

      // Extrair versos
      const verses: HymnVerse[] = [];
      // Regex ajustado para capturar todo o conteúdo entre <lines> e </lines>, incluindo <br/>
      const verseRegex = /<verse name="([^"]+)">\s*<lines>([\s\S]*?)<\/lines>\s*<\/verse>/g;
      
      let match;
      while ((match = verseRegex.exec(xml)) !== null) {
        const name = match[1];
        const content = match[2];
        
        // Determinar tipo (chorus ou verse)
        const type = name.toLowerCase().startsWith('c') ? 'chorus' : 'verse';
        
        // Dividir linhas por <br/>
        const lines = content
          .split(/<br\s*\/?>/)
          .map(line => line.trim())
          .filter(line => line.length > 0);

        verses.push({
          name,
          type,
          lines,
        });
      }

      console.log(`[HarpaService] Hino parseado: ${title}, ${verses.length} versos encontrados`);
      if (verses.length === 0) {
        console.warn(`[HarpaService] AVISO: Nenhum verso encontrado no XML!`);
        console.log(`[HarpaService] XML snippet:`, xml.substring(0, 500));
      }

      return {
        id: fileId,
        number,
        title,
        copyright,
        author,
        verses,
      };
    } catch (error) {
      console.error('[HarpaService] Erro ao parsear XML:', error);
      throw error;
    }
  }

  /**
   * Carrega todos os hinos (com cache)
   */
  async loadAllHymns(): Promise<Hymn[]> {
    if (this.hymnsCache) {
      console.log('[HarpaService] Retornando hinos do cache');
      return this.hymnsCache;
    }

    try {
      const files = await this.listHymnsFromDrive();
      const hymns: Hymn[] = [];

      console.log(`[HarpaService] Carregando ${files.length} hinos encontrados...`);
      
      // Baixar e parsear cada hino encontrado
      for (const file of files) {
        try {
          const xml = await this.downloadHymn(file.id);
          const hymn = this.parseHymnXML(xml, file.id, file.name);
          hymn.number = file.number; // Garantir que o número está correto
          hymns.push(hymn);
        } catch (error) {
          console.error(`[HarpaService] Erro ao carregar hino ${file.name}:`, error);
        }
      }

      // Ordenar por número
      hymns.sort((a, b) => a.number - b.number);

      this.hymnsCache = hymns;
      console.log(`[HarpaService] ${hymns.length} hinos carregados com sucesso`);
      
      return hymns;
    } catch (error) {
      console.error('[HarpaService] Erro ao carregar todos os hinos:', error);
      throw error;
    }
  }

  /**
   * Carrega hinos progressivamente, chamando callback a cada hino carregado
   */
  async loadAllHymnsProgressively(onProgress: (hymns: Hymn[]) => void): Promise<void> {
    if (this.hymnsCache) {
      console.log('[HarpaService] Retornando hinos do cache');
      onProgress(this.hymnsCache);
      return;
    }

    try {
      const hymns: Hymn[] = [];
      const maxHymns = 20; // Reduzido para 20 para evitar bloqueio do Google
      let loadedCount = 0;

      console.log(`[HarpaService] Carregando até ${maxHymns} hinos progressivamente...`);
      
      // Buscar e baixar cada hino progressivamente (não esperar listar todos)
      for (let i = 1; i <= maxHymns; i++) {
        try {
          // Buscar arquivo no Drive
          const file = await this.searchHymnInDrive(i);
          
          if (!file) {
            continue;
          }
          
          // Delay de 200ms entre requisições para evitar rate limit
          if (i > 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          // Baixar e parsear imediatamente
          const xml = await this.downloadHymn(file.id);
          const hymn = this.parseHymnXML(xml, file.id, file.name);
          hymn.number = i; // Garantir que o número está correto
          hymns.push(hymn);
          loadedCount++;
          
          // Ordenar por número antes de chamar callback
          hymns.sort((a, b) => a.number - b.number);
          
          // Chamar callback a cada 2 hinos carregados ou nos primeiros 3
          if (loadedCount <= 3 || loadedCount % 2 === 0) {
            console.log(`[HarpaService] ✓ Callback: ${loadedCount} hinos carregados`);
            onProgress([...hymns]);
          }
        } catch (error) {
          console.error(`[HarpaService] Erro ao carregar hino ${i}:`, error);
        }
        
        // Feedback a cada 5 hinos processados
        if (i % 5 === 0) {
          console.log(`[HarpaService] Processados ${i}/${maxHymns}, carregados: ${loadedCount}`);
        }
      }
      
      // Callback final com todos os hinos
      onProgress([...hymns]);

      this.hymnsCache = hymns;
      console.log(`[HarpaService] ✓ Total: ${loadedCount} hinos carregados progressivamente`);
    } catch (error) {
      console.error('[HarpaService] Erro ao carregar hinos progressivamente:', error);
      throw error;
    }
  }

  /**
   * Busca e baixa um hino específico por número (sob demanda)
   */
  async getHymnByNumber(number: number): Promise<Hymn | null> {
    // Verificar cache primeiro
    if (this.hymnDetailsCache.has(number)) {
      console.log(`[HarpaService] Hino ${number} já está em cache`);
      return this.hymnDetailsCache.get(number)!;
    }

    try {
      console.log(`[HarpaService] Buscando hino ${number}...`);
      
      // Buscar arquivo no Drive
      const file = await this.searchHymnInDrive(number);
      
      if (!file) {
        console.log(`[HarpaService] Hino ${number} não encontrado no Drive`);
        return null;
      }
      
      // Baixar e parsear
      const xml = await this.downloadHymn(file.id);
      const hymn = this.parseHymnXML(xml, file.id, file.name);
      hymn.number = number;
      
      // Salvar em cache
      this.hymnDetailsCache.set(number, hymn);
      
      console.log(`[HarpaService] ✓ Hino ${number} carregado: ${hymn.title}`);
      return hymn;
    } catch (error) {
      console.error(`[HarpaService] Erro ao buscar hino ${number}:`, error);
      return null;
    }
  }

  /**
   * Limpa o cache
   */
  clearCache() {
    this.hymnsCache = null;
    this.hymnDetailsCache.clear();
  }
}

export default new HarpaService();
