# Migração de XML para JSON - Harpa Cristã

## Problema Identificado

Ao usar o parsing de arquivos XML da Harpa Cristã, alguns trechos dos hinos ficavam quebrados ou com texto malformado. Isso ocorria devido à complexidade de parsear os elementos `<br>` e estrutura aninhada do XML.

## Solução Implementada

Migração do sistema de parsing de **XML (de arquivo ZIP)** para **JSON (arquivo único)**.

### Arquivos Modificados

#### 1. `services/HarpaOfflineService.ts`

**Mudanças:**
- ✅ Removida dependência `jszip` e `fast-xml-parser`
- ✅ Método `extractZipFromBundle()` modificado para ler JSON
- ✅ Método `extractVerses()` removido (não mais necessário)
- ✅ Parsing simplificado diretamente do JSON

**Antes (XML):**
```typescript
// Descompactar ZIP
const zip = new JSZip();
const zipData = await zip.loadAsync(arrayBuffer);

// Para cada arquivo XML
for (const fileName of files) {
  const content = await file.async('text');
  const parsedXml = xmlParser.parse(content);
  const song = parsedXml.song;
  
  // Extrair verses com lógica complexa
  verses: this.extractVerses(song)
}
```

**Depois (JSON):**
```typescript
// Carregar JSON direto
const jsonAsset = Asset.fromModule(require('../assets/harpa/hc_json.json'));
const response = await fetch(jsonAsset.localUri);
const hymnsData = await response.json();

// Mapear diretamente
verses: hymnJson.verses.map((verse: any) => ({
  name: verse.chorus ? 'Coro' : `Estrofe ${verse.sequence}`,
  type: verse.chorus ? 'chorus' : 'verse',
  lines: verse.lyrics.split('\n').filter((line: string) => line.trim())
}))
```

### Estrutura do JSON

**Arquivo:** `assets/harpa/hc_json.json`

```json
[
  {
    "title": "Chuvas De Graça",
    "number": 1,
    "author": "CPAD / J.R.",
    "verses": [
      {
        "sequence": 1,
        "lyrics": "Chuvas de graça dá-nos, Senhor;\nManda-nos o consolador,\nQue nos reavive o fervor;\nManda, sim, Jesus.",
        "chorus": false
      },
      {
        "sequence": 2,
        "lyrics": "Chuvas de bênçãos, chuvas copiosas,\nNós esperamos, Senhor!\nChuvas de graça manda do céu,\nAs prometidas, ó Salvador!",
        "chorus": true
      }
    ]
  }
]
```

### Vantagens da Migração

1. ✅ **Texto limpo**: Sem problemas de parsing de `<br>` ou elementos XML malformados
2. ✅ **Performance**: Leitura direta de JSON é mais rápida que descompactar ZIP + XML
3. ✅ **Manutenibilidade**: Estrutura JSON é mais simples e clara
4. ✅ **Menos dependências**: Não precisa de JSZip nem fast-xml-parser
5. ✅ **Tamanho**: Arquivo JSON único é menor que ZIP com 640 XMLs

### Compatibilidade

- ✅ Mantém mesma interface `HymnData`
- ✅ Mesmo formato de armazenamento no banco SQLite
- ✅ UI não precisa de alterações
- ✅ Sistema de busca continua funcionando normalmente

### Como Testar

1. Limpar dados da Harpa:
```typescript
await HarpaOfflineService.clearHarpaData();
```

2. Baixar novamente:
```typescript
await HarpaOfflineService.downloadHarpa((progress) => {
  console.log(`Progress: ${progress}%`);
});
```

3. Verificar que todos os 640 hinos foram carregados corretamente
4. Testar busca e visualização de hinos

### Arquivos Obsoletos

Os seguintes arquivos não são mais necessários:
- `assets/harpa/hc_xml.zip` (pode ser removido)

O arquivo necessário agora é:
- `assets/harpa/hc_json.json` (20078 linhas, 640 hinos)

### Dependências Removidas

No `package.json`, as seguintes dependências **NÃO** são mais necessárias:
- `jszip`
- `fast-xml-parser`

Mas podem ser mantidas se houver outros usos no app.
