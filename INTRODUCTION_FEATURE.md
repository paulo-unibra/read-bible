# Funcionalidade de Introdução dos Livros Bíblicos

## Resumo das Alterações

Esta implementação adiciona suporte para exibir introduções dos livros bíblicos quando a tabela `dictionary` está presente nos arquivos .db das Bíblias.

> **ATUALIZAÇÃO**: A introdução agora é exibida como texto corrido em uma interface especial, não como versículos numerados.

### Principais alterações:

## 1. Tipos (types/index.ts)
- Adicionado interface `BookIntroduction` para representar as introduções dos livros

## 2. BibleReaderService.ts
- **Método `getBookIntroduction()`**: Busca introdução na tabela `dictionary` do banco
- **Método `getBookVariations()`**: Gera variações do nome do livro para encontrar na tabela
- **Método `cleanIntroductionHtml()`**: Converte HTML da introdução para texto formatado
- **Modificação em `getChapters()`**: Adiciona "capítulo 0" (introdução) quando existe introdução
- **Modificação em `getVerses()`**: Retorna dados da introdução processados quando capítulo = 0

## 3. chapter-reader.tsx
- **Navegação**: Atualizada para lidar com capítulo 0 (introdução)
- **Interface especial para introdução**: 
  - Título mostra "Introdução" ao invés de "0"
  - Quiz e áudio desabilitados para introdução
  - **ScrollView** ao invés de FlatList para texto corrido
  - **Estilos especiais**: Card elegante com fundo diferenciado
  - **Typography**: Fontes e espaçamentos otimizados para leitura
- **Seletor de capítulos**: Inclui "Intro" na lista quando existe introdução
- **Cálculo correto**: `totalChapters` não conta a introdução

## Como funciona:

1. **Detecção automática**: Verifica se existe tabela `dictionary` no banco da Bíblia
2. **Busca por nome**: Procura o nome do livro na coluna `word` (ex: "GÊNESIS", "ÊXODO")
3. **Múltiplas variações**: Tenta diferentes versões do nome (com/sem acentos, números, etc.)
4. **Inserção como capítulo 0**: Quando encontra, adiciona antes do capítulo 1
5. **Renderização especial**: 
   - **Interface única**: ScrollView com card elegante
   - **Título destacado**: "Introdução" com tipografia especial
   - **HTML limpo**: Tabelas e formatação convertidas para texto legível
   - **Sem numeração**: Texto corrido sem números de versículos
   - **Botões desabilitados**: Quiz e áudio não aparecem na introdução

## Estrutura esperada da tabela `dictionary`:

```sql
CREATE TABLE dictionary (
  word TEXT,  -- Nome do livro (ex: GÊNESIS, ÊXODO)
  data TEXT   -- Conteúdo HTML da introdução
);
```

## Exemplo de conteúdo na coluna `data`:
```html
<table style="width: 100%;"><tbody>
<tr><th colspan="2">Livro de Gênesis</th></tr>
<tr><td>Autor:</td><td>Moisés</td></tr>
<tr><td>Tema:</td><td>Os Começos</td></tr>
</tbody></table>
<h2>Considerações Preliminares</h2>
<p>É muito apropriado o lugar que Gênesis ocupa...</p>
```

## Visualização da Introdução

A introdução é exibida em uma interface especial com:

### Elementos visuais:
- **Card principal**: Fundo branco/escuro com bordas arredondadas
- **Título centralizado**: "Introdução" em fonte grande e negrito
- **Área de conteúdo**: Fundo cinza claro com borda azul à esquerda
- **Tipografia**: Texto justificado com espaçamento otimizado para leitura

### Processamento do conteúdo:
- **Tabelas HTML** → Texto formatado (ex: "Autor: Moisés")
- **Cabeçalhos** → Quebras de linha com destaque
- **Parágrafos** → Espaçamento adequado entre seções
- **Tags HTML** → Removidas mantendo apenas o texto

### Exemplo de transformação:
```html
<!-- HTML original -->
<table><tr><th>Livro de Gênesis</th></tr><tr><td>Autor:</td><td>Moisés</td></tr></table>
<h2>Considerações Preliminares</h2><p>É muito apropriado...</p>

<!-- Resultado exibido -->
Livro de Gênesis
Autor: Moisés

Considerações Preliminares

É muito apropriado...
```

A implementação é **retrocompatível** - funciona com Bíblias que não têm a tabela `dictionary` sem problemas.